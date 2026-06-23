import pytest

from aleph_siliconflow_mcp.client import SiliconFlowError
from aleph_siliconflow_mcp.videos import (
    build_video_payload,
    parse_status_response,
    parse_submit_response,
)


def test_build_video_payload_t2v():
    p = build_video_payload(prompt="a wave", model="Wan-AI/Wan2.2-T2V-A14B", image_size="1280x720")
    assert p == {"model": "Wan-AI/Wan2.2-T2V-A14B", "prompt": "a wave", "image_size": "1280x720"}


def test_build_video_payload_i2v_with_options():
    p = build_video_payload(
        prompt="pan", model="Wan-AI/Wan2.2-I2V-A14B", image_size="960x960",
        image="https://x/a.png", negative_prompt="shaky", seed=3,
    )
    assert p["image"] == "https://x/a.png"
    assert p["negative_prompt"] == "shaky"
    assert p["seed"] == 3


def test_parse_submit_ok():
    assert parse_submit_response({"requestId": "req-1"}) == "req-1"


def test_parse_submit_missing_raises():
    with pytest.raises(SiliconFlowError):
        parse_submit_response({"oops": 1})


def test_parse_status_succeed():
    data = {"status": "Succeed", "results": {"videos": [{"url": "https://x/v.mp4"}]}}
    out = parse_status_response(data)
    assert out["status"] == "Succeed"
    assert out["urls"] == ["https://x/v.mp4"]


def test_parse_status_failed_carries_reason():
    out = parse_status_response({"status": "Failed", "reason": "nsfw"})
    assert out["status"] == "Failed"
    assert out["reason"] == "nsfw"
    assert out["urls"] == []


def test_parse_status_in_progress():
    out = parse_status_response({"status": "InProgress"})
    assert out["status"] == "InProgress"
    assert out["urls"] == []
