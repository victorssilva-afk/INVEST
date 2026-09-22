"""Backend contract tests for Crypto.Invest remote support reconnect flow.

Focus: verify /api/public/support/connect + WS /api/ws/support/{code} relay
correctly forwards request-offer/offer/answer/ice between viewer (tech) and
client peers so that clicking Reconnect on the viewer alone re-establishes
the WebRTC signaling round trip.
"""
import asyncio
import json
import os
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
WS_BASE = BASE_URL.replace("http", "ws", 1) + "/api/ws"

ADMIN_EMAIL = "euapostomesmo@proton.me"
ADMIN_PW = "Invest2026!"


# ----- helpers -----------------------------------------------------------
def login(email=ADMIN_EMAIL, pw=ADMIN_PW):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


# ----- basic auth + endpoints -------------------------------------------
class TestAuthAndListing:
    def test_admin_login(self):
        tok = login()
        assert tok and isinstance(tok, str)

    def test_me(self):
        tok = login()
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_ice_servers(self):
        r = requests.get(f"{BASE_URL}/api/support/ice", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json().get("iceServers"), list)


# ----- device registration ----------------------------------------------
class TestDeviceRegistration:
    def test_public_connect_creates_session(self):
        did = f"TEST_dev_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/public/support/connect",
                          json={"device_id": did, "device_name": "TEST_Chromium"}, timeout=10)
        assert r.status_code == 200
        code = r.json()["code"]
        assert code and len(code) >= 6

        # Reconnect same device_id should reuse code
        r2 = requests.post(f"{BASE_URL}/api/public/support/connect",
                           json={"device_id": did, "device_name": "TEST_Chromium"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["code"] == code

    def test_admin_sees_session_in_list(self):
        did = f"TEST_dev_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/public/support/connect",
                          json={"device_id": did, "device_name": "TEST_ListDev"}, timeout=10)
        code = r.json()["code"]
        tok = login()
        r2 = requests.get(f"{BASE_URL}/api/support/sessions",
                          headers={"Authorization": f"Bearer {tok}"}, timeout=10)
        assert r2.status_code == 200
        codes = [s["code"] for s in r2.json()]
        assert code in codes


# ----- websocket signaling contract -------------------------------------
async def _recv_type(ws, want, timeout=5.0):
    """Consume messages until we get one matching `want` (str or set)."""
    if isinstance(want, str):
        want = {want}
    end = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < end:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        msg = json.loads(raw)
        if msg.get("type") in want:
            return msg
    raise AssertionError(f"Did not receive {want} within {timeout}s")


async def _drain(ws, seconds=0.3):
    end = asyncio.get_event_loop().time() + seconds
    while asyncio.get_event_loop().time() < end:
        try:
            await asyncio.wait_for(ws.recv(), timeout=max(0.01, end - asyncio.get_event_loop().time()))
        except (asyncio.TimeoutError, Exception):
            return


class TestReconnectSignalingContract:
    """Simulates viewer clicking Reconnect: viewer sends request-offer,
    client replies with offer, viewer sends answer. Ensures backend relays."""

    @pytest.mark.asyncio
    async def test_request_offer_roundtrip(self):
        # 1. register a device (client side already 'installed')
        did = f"TEST_dev_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/public/support/connect",
                          json={"device_id": did, "device_name": "TEST_SignalDev"}, timeout=10)
        code = r.json()["code"]

        client_url = f"{WS_BASE}/support/{code}?role=client"
        tech_url = f"{WS_BASE}/support/{code}?role=tech"

        # 2. client connects first (as an already-installed device waiting)
        async with websockets.connect(client_url) as ws_client:
            await asyncio.sleep(0.2)

            # 3. tech (viewer) connects — should receive peer-joined(client)
            async with websockets.connect(tech_url) as ws_tech:
                # tech gets peer-joined role=client (already there)
                pj = await _recv_type(ws_tech, "peer-joined")
                assert pj["role"] == "client"

                # client gets peer-joined role=tech
                pj2 = await _recv_type(ws_client, "peer-joined")
                assert pj2["role"] == "tech"

                # 4. VIEWER RECONNECT: send request-offer (this is the main fix)
                await ws_tech.send(json.dumps({"type": "request-offer"}))

                # 5. client must receive request-offer and would call buildAndOffer()
                req = await _recv_type(ws_client, "request-offer")
                assert req["type"] == "request-offer"

                # Simulate client responding with fresh offer
                await ws_client.send(json.dumps({"type": "offer",
                                                 "sdp": {"type": "offer", "sdp": "v=0\r\nfake"}}))
                offer_msg = await _recv_type(ws_tech, "offer")
                assert offer_msg["sdp"]["type"] == "offer"

                # Viewer sends answer
                await ws_tech.send(json.dumps({"type": "answer",
                                                "sdp": {"type": "answer", "sdp": "v=0\r\nfake-ans"}}))
                ans_msg = await _recv_type(ws_client, "answer")
                assert ans_msg["sdp"]["type"] == "answer"

                # ICE candidate relay both ways
                await ws_tech.send(json.dumps({"type": "ice", "candidate": {"candidate": "cand-tech"}}))
                ice1 = await _recv_type(ws_client, "ice")
                assert ice1["candidate"]["candidate"] == "cand-tech"

                await ws_client.send(json.dumps({"type": "ice", "candidate": {"candidate": "cand-client"}}))
                ice2 = await _recv_type(ws_tech, "ice")
                assert ice2["candidate"]["candidate"] == "cand-client"

    @pytest.mark.asyncio
    async def test_viewer_only_reconnect_client_stays_passive(self):
        """The main fix contract: viewer alone triggers a fresh offer even
        when the client did not click anything. We simulate a 'second connect'
        by closing the tech WS and opening a new one — client (still online)
        must be prompted via request-offer to build a fresh peer."""
        did = f"TEST_dev_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{BASE_URL}/api/public/support/connect",
                          json={"device_id": did, "device_name": "TEST_PassiveClient"}, timeout=10)
        code = r.json()["code"]

        client_url = f"{WS_BASE}/support/{code}?role=client"
        tech_url = f"{WS_BASE}/support/{code}?role=tech"

        async with websockets.connect(client_url) as ws_client:
            # First tech session — establish then close
            async with websockets.connect(tech_url) as ws_tech1:
                await _recv_type(ws_tech1, "peer-joined")
                await _recv_type(ws_client, "peer-joined")
                # tech sends request-offer on onopen
                await ws_tech1.send(json.dumps({"type": "request-offer"}))
                await _recv_type(ws_client, "request-offer")

            # client should observe peer-left(tech)
            await _drain(ws_client, 0.5)

            # Second tech connection = clicking Reconnect / opening viewer again
            async with websockets.connect(tech_url) as ws_tech2:
                pj = await _recv_type(ws_tech2, "peer-joined")
                assert pj["role"] == "client"
                # Simulate viewer onopen sending request-offer (the fix)
                await ws_tech2.send(json.dumps({"type": "request-offer"}))
                # Client (passive) receives it — code path that triggers buildAndOffer
                req = await _recv_type(ws_client, "request-offer")
                assert req["type"] == "request-offer"
