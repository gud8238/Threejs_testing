"""Minimal Gemini REST client.

The real API key is never read or stored here: the session's network proxy injects
`x-goog-api-key` for generativelanguage.googleapis.com. We send a placeholder that the
proxy replaces.
"""
import base64
import json
import os
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta"
TTS_MODEL = "gemini-3.8-flash-tts"
MUSIC_MODEL = "lyria-3.5"


def _req(method: str, path: str, body: dict | None = None, timeout=300) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{BASE}/{path}", data=data, method=method, headers={
        "Content-Type": "application/json", "x-goog-api-key": "PROXY_INJECTED"})
    ctx = None
    cafile = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
    if os.path.exists(cafile):
        import ssl
        ctx = ssl.create_default_context(cafile=cafile)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return json.loads(r.read())


def post(path: str, body: dict) -> dict:
    return _req("POST", path, body)


def list_models() -> list[str]:
    return [m["name"].split("/")[-1] for m in _req("GET", "models?pageSize=1000").get("models", [])]


def audio_parts(resp: dict) -> list[bytes]:
    out = []
    for c in resp.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            inline = p.get("inlineData") or p.get("inline_data")
            if inline and inline.get("data"):
                out.append(base64.b64decode(inline["data"]))
    return out


def tts(text: str, voice: str, style: str) -> bytes:
    """Returns WAV bytes (24 kHz mono)."""
    resp = post(f"models/{TTS_MODEL}:generateContent", {
        "contents": [{"role": "user", "parts": [{"text": text, "speech_metadata": {"style": style}}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
                             "speechConfig": {"voiceConfig": {"voice": voice}}}})
    return audio_parts(resp)[0]


def music(prompt: str) -> bytes:
    """Returns WAV bytes."""
    resp = post(f"models/{MUSIC_MODEL}:generateContent", {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["AUDIO", "TEXT"],
                             "responseFormat": {"audio": {"mimeType": "AUDIO_WAV"}}}}, )
    return audio_parts(resp)[0]
