"""Config, HTTP client, error handling, and local asset saving."""

from __future__ import annotations

import base64
import json as _json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx

DEFAULT_API_BASE = "https://api.siliconflow.cn/v1"
REQUEST_TIMEOUT = 300.0


class SiliconFlowError(Exception):
    """User-facing error from the SiliconFlow API or local IO."""


@dataclass(frozen=True)
class Settings:
    api_key: str
    api_base: str
    image_dir: str | None
    audio_dir: str | None

    @classmethod
    def from_env(cls) -> "Settings":
        image_dir = os.getenv("SILICONFLOW_IMAGE_DIR") or None
        audio_dir = os.getenv("SILICONFLOW_AUDIO_DIR") or image_dir
        api_base = (os.getenv("SILICONFLOW_API_BASE") or DEFAULT_API_BASE).rstrip("/")
        return cls(
            api_key=os.getenv("SILICONFLOW_API_KEY", "").strip(),
            api_base=api_base,
            image_dir=image_dir,
            audio_dir=audio_dir,
        )


def extract_api_error(status_code: int, body: str) -> str:
    """Best-effort human-readable message from an error response body (pure)."""
    message = body
    try:
        parsed = _json.loads(body)
        if isinstance(parsed, dict):
            err = parsed.get("error")
            err_msg = err.get("message") if isinstance(err, dict) else err
            message = parsed.get("message") or err_msg or body
    except (ValueError, AttributeError):
        pass
    return f"SiliconFlow API error {status_code}: {message}"


def ext_from_url(url: str, default: str = ".png") -> str:
    """Derive a file extension from a URL path (pure)."""
    path = urlparse(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".mp4", ".webp"):
        if path.endswith(ext):
            return ext
    return default


def build_filename(prefix: str, ext: str, stamp: int) -> str:
    """Deterministic asset filename (pure)."""
    if not ext.startswith("."):
        ext = "." + ext
    return f"{prefix}_{stamp}{ext}"


def looks_remote(value: str) -> bool:
    """True if value is an http(s) URL or a data URI (pure)."""
    return value.startswith(("http://", "https://", "data:"))


def to_image_field(value: str) -> str:
    """Pass through a URL/data-URI; base64-encode a local file path."""
    if looks_remote(value):
        return value
    path = Path(value)
    if not path.is_file():
        raise SiliconFlowError(f"image file not found: {value}")
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    suffix = path.suffix.lstrip(".") or "png"
    return f"data:image/{suffix};base64,{data}"


class SiliconFlowClient:
    def __init__(self, settings: Settings):
        if not settings.api_key:
            raise SiliconFlowError("SILICONFLOW_API_KEY is not set")
        self.settings = settings

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.settings.api_key}"}

    def _url(self, path: str) -> str:
        return f"{self.settings.api_base}/{path.lstrip('/')}"

    async def request_json(self, method: str, path: str, *, json=None, params=None) -> dict:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.request(
                method, self._url(path), headers=self._headers, json=json, params=params
            )
        if resp.status_code >= 400:
            raise SiliconFlowError(extract_api_error(resp.status_code, resp.text))
        return resp.json()

    async def request_binary(self, method: str, path: str, *, json=None) -> bytes:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.request(
                method, self._url(path), headers=self._headers, json=json
            )
        if resp.status_code >= 400:
            raise SiliconFlowError(extract_api_error(resp.status_code, resp.text))
        return resp.content

    async def download(self, url: str, save_dir: str, prefix: str) -> str:
        """Download asset to save_dir; on any failure return the original URL."""
        try:
            target = Path(save_dir)
            target.mkdir(parents=True, exist_ok=True)
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.get(url)
            resp.raise_for_status()
            name = build_filename(prefix, ext_from_url(url), int(time.time()))
            file_path = target / name
            file_path.write_bytes(resp.content)
            return str(file_path.resolve())
        except Exception:
            return url

    def save_binary(self, content: bytes, save_dir: str, ext: str, prefix: str) -> str:
        target = Path(save_dir)
        target.mkdir(parents=True, exist_ok=True)
        name = build_filename(prefix, ext, int(time.time()))
        file_path = target / name
        file_path.write_bytes(content)
        return str(file_path.resolve())


_client: SiliconFlowClient | None = None


def get_client() -> SiliconFlowClient:
    """Lazy singleton built from env (avoids import-time env reads)."""
    global _client
    if _client is None:
        _client = SiliconFlowClient(Settings.from_env())
    return _client


async def render_assets(
    client: SiliconFlowClient,
    kind: str,
    urls: list[str],
    save_dir: str | None,
    prefix: str,
    header: str,
) -> str:
    """Download each url (if save_dir set) and format an LLM-readable summary."""
    if not urls:
        return f"{header}: no {kind} returned by the API."
    lines = [header + ":"]
    for i, url in enumerate(urls, 1):
        if save_dir:
            local = await client.download(url, save_dir, prefix)
            lines.append(f"  {i}. {local}  (source: {url})")
        else:
            lines.append(
                f"  {i}. {url}  (remote URL, expires soon — set a save dir to keep it)"
            )
    return "\n".join(lines)
