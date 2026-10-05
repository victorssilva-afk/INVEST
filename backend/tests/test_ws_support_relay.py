"""WS relay tests for /api/ws/support/{code} - tech<->client remote-control signaling."""
import asyncio
import os
import secrets
import pytest
import websockets
import json

BASE_HTTP = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0]
BASE_WS = BASE_HTTP.replace("https://", "wss://").replace("http://", "ws://").rstrip("/")


def ws_url(code: str, role: str) -> str:
    return f"{BASE_WS}/api/ws/support/{code}?role={role}"


async def recv_json(ws, timeout=5):
    msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
    return json.loads(msg)


async def drain(ws, timeout=0.5):
    msgs = []
    try:
        while True:
            msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
            msgs.append(json.loads(msg))
    except (asyncio.TimeoutError, Exception):
        pass
    return msgs


@pytest.mark.asyncio
async def test_peer_joined_on_connect():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        # client should receive peer-joined with role=tech
        msg_c = await recv_json(client)
        assert msg_c == {"type": "peer-joined", "role": "tech"}
        # tech should receive peer-joined with role=client
        msg_t = await recv_json(tech)
        assert msg_t == {"type": "peer-joined", "role": "client"}
    finally:
        await client.close()
        await tech.close()


@pytest.mark.asyncio
async def test_tech_tap_relayed_to_client():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        await recv_json(client)  # peer-joined
        await recv_json(tech)
        payload = {"type": "gesture", "action": "tap", "x": 0.5, "y": 0.5}
        await tech.send(json.dumps(payload))
        got = await recv_json(client)
        assert got == payload
    finally:
        await client.close()
        await tech.close()


@pytest.mark.asyncio
async def test_tech_swipe_relayed():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        await recv_json(client); await recv_json(tech)
        payload = {"type": "gesture", "action": "swipe", "x": 0.1, "y": 0.1, "x2": 0.9, "y2": 0.9, "duration": 300}
        await tech.send(json.dumps(payload))
        got = await recv_json(client)
        assert got == payload
    finally:
        await client.close(); await tech.close()


@pytest.mark.asyncio
async def test_tech_text_key_nav_relayed():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        await recv_json(client); await recv_json(tech)
        for payload in [
            {"type": "text", "value": "ola"},
            {"type": "key", "key": "Enter"},
            {"type": "nav", "action": "home"},
        ]:
            await tech.send(json.dumps(payload))
            got = await recv_json(client)
            assert got == payload
    finally:
        await client.close(); await tech.close()


@pytest.mark.asyncio
async def test_client_to_tech_reverse():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        await recv_json(client); await recv_json(tech)
        payload = {"type": "offer", "sdp": {"type": "offer", "sdp": "v=0..."}}
        await client.send(json.dumps(payload))
        got = await recv_json(tech)
        assert got == payload
    finally:
        await client.close(); await tech.close()


@pytest.mark.asyncio
async def test_isolation_same_role_and_cross_room():
    code1 = secrets.token_hex(4)
    code2 = secrets.token_hex(4)
    client1 = await websockets.connect(ws_url(code1, "client"))
    tech1 = await websockets.connect(ws_url(code1, "tech"))
    tech1b = await websockets.connect(ws_url(code1, "tech"))  # same role as tech1
    client2 = await websockets.connect(ws_url(code2, "client"))
    try:
        # drain peer-joined
        await drain(client1); await drain(tech1); await drain(tech1b); await drain(client2)
        payload = {"type": "gesture", "action": "tap", "x": 0.2, "y": 0.3}
        await tech1.send(json.dumps(payload))
        # client1 should get it
        got = await recv_json(client1)
        assert got == payload
        # tech1b (same role) should NOT get it
        extras_tech1b = await drain(tech1b, timeout=0.8)
        assert payload not in extras_tech1b
        # client2 (different room) should NOT get it
        extras_client2 = await drain(client2, timeout=0.5)
        assert payload not in extras_client2
    finally:
        for w in [client1, tech1, tech1b, client2]:
            await w.close()


@pytest.mark.asyncio
async def test_peer_left_on_disconnect():
    code = secrets.token_hex(4)
    client = await websockets.connect(ws_url(code, "client"))
    tech = await websockets.connect(ws_url(code, "tech"))
    try:
        await recv_json(client); await recv_json(tech)
        await tech.close()
        msg = await recv_json(client, timeout=5)
        assert msg == {"type": "peer-left", "role": "tech"}
    finally:
        await client.close()
