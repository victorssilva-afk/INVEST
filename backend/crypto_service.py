"""INVEST — Crypto intelligence service. Real data via CoinGecko + Alternative.me (free),
technical indicators computed from real price series, rule-based scoring, and AI report (GPT-5.4)."""
import os
import json
import time
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx
import numpy as np

CG = "https://api.coingecko.com/api/v3"
CB = "https://api.exchange.coinbase.com"
FNG = "https://api.alternative.me/fng/"

# symbol -> display name. Pairs available on Coinbase (primary free source, reachable here).
COINS = {
    "BTC": "Bitcoin", "ETH": "Ethereum", "SOL": "Solana", "XRP": "XRP",
    "ADA": "Cardano", "DOGE": "Dogecoin", "AVAX": "Avalanche", "LINK": "Chainlink",
    "DOT": "Polkadot", "LTC": "Litecoin", "MATIC": "Polygon", "ATOM": "Cosmos",
}
CBPAIRS = {s: f"{s}-USD" for s in COINS}

_cache = {}


def _get(key, ttl):
    v = _cache.get(key)
    if v and (time.time() - v[0]) < ttl:
        return v[1]
    return None


def _set(key, val):
    _cache[key] = (time.time(), val)
    return val


async def _fetch_json(url, params=None, ttl=30, timeout=15):
    key = url + "?" + str(params)
    cached = _get(key, ttl)
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(url, params=params, headers={"accept": "application/json", "User-Agent": "INVEST/1.0"})
        r.raise_for_status()
        data = r.json()
    return _set(key, data)


async def get_market(symbols=None):
    """Primary source: Coinbase public API (free, reachable). Changes computed from daily candles."""
    syms = [s for s in (symbols or list(COINS)) if s in COINS] or list(COINS)

    async def one(s):
        try:
            data = await _fetch_json(f"{CB}/products/{CBPAIRS[s]}/candles", {"granularity": 86400}, ttl=90)
            c = sorted(data, key=lambda x: x[0])  # [time, low, high, open, close, volume] ascending
            closes = [x[4] for x in c]
            if not closes:
                return None
            price = closes[-1]

            def chg(n):
                return round((price / closes[-1 - n] - 1) * 100, 2) if len(closes) > n else None
            last = c[-1]
            return {
                "symbol": s, "name": COINS[s], "image": None, "price": price,
                "change_1h": None, "change_24h": chg(1), "change_7d": chg(7), "change_30d": chg(30),
                "volume": round(last[5] * price), "market_cap": None,
                "high_24h": last[2], "low_24h": last[1], "ath": None,
            }
        except Exception:
            return None
    res = await asyncio.gather(*[one(s) for s in syms])
    return [r for r in res if r]


async def get_global():
    data = (await _fetch_json(f"{CG}/global", ttl=120)).get("data", {})
    return {
        "total_market_cap": data.get("total_market_cap", {}).get("usd"),
        "total_volume": data.get("total_volume", {}).get("usd"),
        "btc_dominance": data.get("market_cap_percentage", {}).get("btc"),
        "eth_dominance": data.get("market_cap_percentage", {}).get("eth"),
        "market_cap_change_24h": data.get("market_cap_change_percentage_24h_usd"),
        "active_cryptos": data.get("active_cryptocurrencies"),
    }


async def get_fng():
    try:
        d = await _fetch_json(FNG, {"limit": 2}, ttl=600)
        cur = d["data"][0]
        return {"value": int(cur["value"]), "classification": cur["value_classification"],
                "available": True}
    except Exception:
        return {"value": None, "classification": None, "available": False}


async def get_stablecoins():
    try:
        data = await _fetch_json(f"{CG}/coins/markets", {
            "vs_currency": "usd", "ids": "tether,usd-coin,dai", "sparkline": "false",
        }, ttl=300)
        return [{"symbol": d["symbol"].upper(), "name": d["name"],
                 "market_cap": d.get("market_cap"), "volume": d.get("total_volume"),
                 "change_24h": d.get("price_change_percentage_24h")} for d in data]
    except Exception:
        return []


async def get_chart(symbol, days):
    """Coinbase candles -> price series for charting and indicators."""
    pair = CBPAIRS.get(symbol.upper(), "BTC-USD")
    gran = {"1": 900, "7": 3600, "30": 21600, "90": 86400, "365": 86400}.get(str(days), 21600)
    data = await _fetch_json(f"{CB}/products/{pair}/candles", {"granularity": gran}, ttl=120)
    c = sorted(data, key=lambda x: x[0])  # [time, low, high, open, close, volume]
    prices = [{"t": int(x[0]) * 1000, "p": float(x[4])} for x in c]
    volumes = [{"t": int(x[0]) * 1000, "v": float(x[5])} for x in c]
    return {"prices": prices, "volumes": volumes}


# ---------- Technical indicators ----------
def _ema(arr, n):
    if len(arr) < n:
        return None
    k = 2 / (n + 1)
    e = np.mean(arr[:n])
    for x in arr[n:]:
        e = x * k + e * (1 - k)
    return float(e)


def _sma(arr, n):
    if len(arr) < n:
        return None
    return float(np.mean(arr[-n:]))


def _rsi(arr, n=14):
    if len(arr) < n + 1:
        return None
    diffs = np.diff(arr)
    gains = np.where(diffs > 0, diffs, 0.0)
    losses = np.where(diffs < 0, -diffs, 0.0)
    ag = np.mean(gains[-n:])
    al = np.mean(losses[-n:])
    if al == 0:
        return 100.0
    rs = ag / al
    return float(100 - (100 / (1 + rs)))


def _macd(arr):
    if len(arr) < 26:
        return None, None
    e12 = _ema(arr, 12)
    e26 = _ema(arr, 26)
    if e12 is None or e26 is None:
        return None, None
    return float(e12 - e26), float(e26)


def compute_indicators(prices):
    arr = np.array([p["p"] for p in prices], dtype=float)
    if len(arr) < 15:
        return None
    price = float(arr[-1])
    rsi = _rsi(arr)
    macd, _ = _macd(arr)
    ema50 = _ema(arr, min(50, len(arr) - 1))
    ema200 = _ema(arr, min(200, len(arr) - 1))
    sma20 = _sma(arr, 20)
    std20 = float(np.std(arr[-20:])) if len(arr) >= 20 else None
    boll_up = (sma20 + 2 * std20) if sma20 and std20 else None
    boll_dn = (sma20 - 2 * std20) if sma20 and std20 else None
    # support/resistance from recent window
    window = arr[-min(len(arr), 120):]
    support = float(np.min(window))
    resistance = float(np.max(window))
    return {
        "price": round(price, 2), "rsi": round(rsi, 1) if rsi else None,
        "macd": round(macd, 2) if macd else None,
        "ema50": round(ema50, 2) if ema50 else None,
        "ema200": round(ema200, 2) if ema200 else None,
        "sma20": round(sma20, 2) if sma20 else None,
        "boll_up": round(boll_up, 2) if boll_up else None,
        "boll_dn": round(boll_dn, 2) if boll_dn else None,
        "support": round(support, 2), "resistance": round(resistance, 2),
    }


def _clamp(v):
    return max(-100, min(100, v))


def compute_scores(ind, fng, stables, market_change):
    """Rule-based, transparent multi-factor scoring (-100..+100). Marks data availability."""
    factors = []
    # Technical
    tech = 0
    tcount = 0
    if ind and ind.get("rsi") is not None:
        r = ind["rsi"]
        tech += (r - 50) * 1.5
        tcount += 1
        factors.append(f"RSI {r}")
    if ind and ind.get("macd") is not None:
        tech += 25 if ind["macd"] > 0 else -25
        tcount += 1
        factors.append("MACD " + ("positivo" if ind["macd"] > 0 else "negativo"))
    if ind and ind.get("ema50") and ind.get("ema200"):
        above = ind["ema50"] > ind["ema200"]
        tech += 25 if above else -25
        tcount += 1
        factors.append("EMA50 " + ("acima" if above else "abaixo") + " EMA200")
    technical = _clamp(tech) if tcount else 0
    # Sentiment (Fear & Greed)
    sentiment = 0
    scount = 0
    if fng.get("available"):
        sentiment = _clamp((fng["value"] - 50) * 2)
        scount = 1
        factors.append(f"Fear&Greed {fng['value']}")
    # Liquidity (stablecoin 24h flow proxy + total mcap change)
    liquidity = 0
    lcount = 0
    if stables:
        avg = np.mean([s.get("change_24h") or 0 for s in stables])
        liquidity = _clamp(avg * 20)
        lcount = 1
        factors.append("Fluxo stablecoins 24h")
    if market_change is not None:
        liquidity = _clamp(liquidity + market_change * 3)
        lcount = 1
    # Macro & On-chain: no free reliable source -> neutral, lower confidence
    macro = 0
    onchain = 0
    parts = [("technical", technical, tcount), ("sentiment", sentiment, scount),
             ("liquidity", liquidity, lcount)]
    avail = sum(1 for _, _, c in parts if c) + 0  # macro/onchain unavailable
    weighted = technical * 0.45 + sentiment * 0.25 + liquidity * 0.30
    final = round(_clamp(weighted))
    # confidence: how many factor groups have data (out of 5)
    have = sum([1 if tcount else 0, 1 if scount else 0, 1 if lcount else 0, 0, 0])
    confidence = int(30 + have / 5 * 55 + (10 if tcount >= 3 else 0))
    confidence = min(confidence, 92)
    return {
        "technical_score": round(technical), "macro_score": 0,
        "sentiment_score": round(sentiment), "onchain_score": 0,
        "liquidity_score": round(liquidity), "final_score": final,
        "confidence": confidence, "factors": factors,
        "data_notes": "Macro e On-chain: sem fonte gratuita fiável integrada — pontuação neutra e confiança reduzida.",
    }


def trend_label(score):
    if score >= 40:
        return "Fortemente Bullish"
    if score >= 15:
        return "Moderadamente Bullish"
    if score > -15:
        return "Neutra"
    if score > -40:
        return "Moderadamente Bearish"
    return "Fortemente Bearish"


def signal_distribution(final_score, confidence):
    """Converte score/confiança em percentagens Compra/Neutro/Venda (somam 100)."""
    s = max(-100, min(100, final_score or 0))
    conf = max(0, min(100, confidence or 50))
    neutral = max(8, min(80, 45 - abs(s) * 0.35 + (100 - conf) * 0.25))
    remaining = 100 - neutral
    buy = max(0, min(remaining, remaining * (0.5 + s / 200.0)))
    sell = remaining - buy
    b, n, se = round(buy), round(neutral), round(sell)
    b += 100 - (b + n + se)
    rec = "Compra" if b > se and b >= n else "Venda" if se > b and se >= n else "Neutro"
    direction = "up" if rec == "Compra" else "down" if rec == "Venda" else "neutral"
    return {"buy": b, "neutral": n, "sell": se, "recommendation": rec, "direction": direction}


async def get_news(limit=20):
    """Free RSS from Cointelegraph. Classify bullish/bearish with keyword heuristic."""
    cached = _get("news", 600)
    if cached is not None:
        return cached
    bull = ["surge", "rally", "soar", "gain", "bull", "adopt", "approval", "inflow",
            "record", "high", "buy", "accumulat", "up ", "rise", "jump", "boost"]
    bear = ["crash", "plunge", "drop", "fall", "bear", "hack", "ban", "outflow",
            "sell", "lawsuit", "down", "decline", "liquidat", "fear", "dump", "reject"]
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get("https://cointelegraph.com/rss")
            r.raise_for_status()
            root = ET.fromstring(r.content)
        items = []
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = it.findtext("link") or ""
            pub = it.findtext("pubDate") or ""
            desc = (it.findtext("description") or "")[:240]
            low = (title + " " + desc).lower()
            b = sum(low.count(w) for w in bull)
            s = sum(low.count(w) for w in bear)
            sent = "bullish" if b > s else "bearish" if s > b else "neutra"
            items.append({"title": title, "url": link, "published_at": pub,
                          "summary": desc, "source": "Cointelegraph", "sentiment": sent})
            if len(items) >= limit:
                break
        return _set("news", items)
    except Exception:
        return []


async def generate_ai_report(symbol, timeframe, ind, scores, market_row, glob, fng):
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        ctx = {
            "ativo": symbol, "timeframe": timeframe, "indicadores": ind,
            "scores": scores, "mercado": market_row, "global": glob, "fear_greed": fng,
        }
        system = (
            "És um analista de mercado crypto sénior do INVEST. Escreve SEMPRE em Português de Portugal (PT-PT). "
            "Usa linguagem de probabilidade — NUNCA afirmes certezas ('vai subir/cair'). "
            "Baseia-te apenas nos dados fornecidos. Onde faltarem dados (macro, on-chain), diz explicitamente que não há fonte fiável. "
            "Estrutura a resposta em secções curtas com estes títulos exatos:\n"
            "RESUMO SIMPLES\nESTADO ATUAL\nTÉCNICA\nMACRO\nSENTIMENTO\nLIQUIDEZ\n"
            "CATALISADORES DE ALTA\nCATALISADORES DE BAIXA\n"
            "CENÁRIO BULLISH\nCENÁRIO BASE\nCENÁRIO BEARISH\nRISCOS\nVEREDICTO DO MESTRE INVESTIDOR\nRESUMO\n"
            "Em RESUMO SIMPLES escreve 2-3 frases muito simples, para leigos, sem termos técnicos. "
            "No VEREDICTO DO MESTRE INVESTIDOR assume a voz do investidor mais sábio do planeta, com milénios de "
            "experiência de mercado: indica claramente se COMPRARIAS, VENDERIAS ou ficarias NEUTRO e explica o porquê de "
            "cada decisão, cruzando os reflexos do mercado, possíveis movimentos de baleias on-chain e estratégias "
            "políticas/regulatórias. Mantém linguagem de probabilidade (nunca garantias). "
            "No RESUMO indica tendência de curto/médio/longo prazo. Sê objetivo e conciso."
        )
        chat = LlmChat(api_key=key, session_id=f"crypto-{symbol}-{int(time.time())}",
                       system_message=system).with_model("openai", "gpt-5.4")
        msg = UserMessage(text=f"Gera a análise estruturada com base nestes dados reais:\n{ctx}")
        resp = await chat.send_message(msg)
        return resp if isinstance(resp, str) else str(resp)
    except Exception as e:
        return f"[Análise de IA indisponível: {e}]"
