import pytest

from aleph_siliconflow_mcp.ratios import image_size_for, video_size_for


def test_image_size_known_ratios():
    assert image_size_for("1:1") == "1024x1024"
    assert image_size_for("16:9") == "1024x576"
    assert image_size_for("9:16") == "576x1024"


def test_image_size_unknown_raises():
    with pytest.raises(ValueError, match="aspect_ratio"):
        image_size_for("21:9")


def test_video_size_known_ratios():
    assert video_size_for("16:9") == "1280x720"
    assert video_size_for("9:16") == "720x1280"
    assert video_size_for("1:1") == "960x960"


def test_video_size_unknown_raises():
    with pytest.raises(ValueError, match="aspect_ratio"):
        video_size_for("4:3")
