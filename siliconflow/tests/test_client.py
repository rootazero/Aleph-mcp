import base64

import pytest

from aleph_siliconflow_mcp.client import (
    Settings,
    SiliconFlowError,
    build_filename,
    extract_api_error,
    ext_from_url,
    looks_remote,
    to_image_field,
)


def test_settings_from_env_defaults(monkeypatch):
    monkeypatch.setenv("SILICONFLOW_API_KEY", "  sk-abc ")
    monkeypatch.delenv("SILICONFLOW_API_BASE", raising=False)
    monkeypatch.delenv("SILICONFLOW_IMAGE_DIR", raising=False)
    monkeypatch.delenv("SILICONFLOW_AUDIO_DIR", raising=False)
    s = Settings.from_env()
    assert s.api_key == "sk-abc"
    assert s.api_base == "https://api.siliconflow.cn/v1"
    assert s.image_dir is None
    assert s.audio_dir is None


def test_settings_audio_dir_falls_back_to_image_dir(monkeypatch):
    monkeypatch.setenv("SILICONFLOW_API_KEY", "k")
    monkeypatch.setenv("SILICONFLOW_IMAGE_DIR", "/tmp/imgs")
    monkeypatch.delenv("SILICONFLOW_AUDIO_DIR", raising=False)
    monkeypatch.setenv("SILICONFLOW_API_BASE", "https://api.siliconflow.com/v1/")
    s = Settings.from_env()
    assert s.audio_dir == "/tmp/imgs"
    assert s.api_base == "https://api.siliconflow.com/v1"  # trailing slash stripped


def test_extract_api_error_json_message():
    body = '{"message": "invalid model"}'
    assert extract_api_error(400, body) == "SiliconFlow API error 400: invalid model"


def test_extract_api_error_plain_text():
    assert extract_api_error(500, "boom") == "SiliconFlow API error 500: boom"


def test_ext_from_url():
    assert ext_from_url("https://x/y/a.mp4?sig=1") == ".mp4"
    assert ext_from_url("https://x/y/a.jpeg") == ".jpeg"
    assert ext_from_url("https://x/y/blob") == ".png"


def test_build_filename():
    assert build_filename("image", ".png", 1700) == "image_1700.png"
    assert build_filename("speech", "mp3", 42) == "speech_42.mp3"


def test_looks_remote():
    assert looks_remote("https://x/a.png")
    assert looks_remote("data:image/png;base64,AAA")
    assert not looks_remote("/home/u/a.png")


def test_to_image_field_url_passthrough():
    url = "https://x/a.png"
    assert to_image_field(url) == url


def test_to_image_field_missing_file_raises():
    with pytest.raises(SiliconFlowError, match="not found"):
        to_image_field("/no/such/file.png")


def test_to_image_field_local_file(tmp_path):
    f = tmp_path / "pic.png"
    f.write_bytes(b"\x89PNG")
    out = to_image_field(str(f))
    assert out.startswith("data:image/png;base64,")
    assert base64.b64decode(out.split(",", 1)[1]) == b"\x89PNG"
