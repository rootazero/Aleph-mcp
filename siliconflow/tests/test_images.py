from aleph_siliconflow_mcp.images import build_image_payload, parse_image_response


def test_build_payload_minimal():
    p = build_image_payload(prompt="a cat", model="Kwai-Kolors/Kolors", image_size="1024x1024")
    assert p == {
        "model": "Kwai-Kolors/Kolors",
        "prompt": "a cat",
        "batch_size": 1,
        "num_inference_steps": 20,
        "image_size": "1024x1024",
    }


def test_build_payload_optionals_included_only_when_set():
    p = build_image_payload(
        prompt="x", model="m", image_size="1024x576",
        negative_prompt="blurry", seed=7, guidance_scale=5.0, cfg=4.0,
    )
    assert p["negative_prompt"] == "blurry"
    assert p["seed"] == 7
    assert p["guidance_scale"] == 5.0
    assert p["cfg"] == 4.0


def test_build_payload_edit_omits_image_size_and_carries_images():
    p = build_image_payload(
        prompt="add a hat", model="Qwen/Qwen-Image-Edit-2509",
        images={"image": "data:image/png;base64,AAA", "image2": None},
    )
    assert "image_size" not in p
    assert p["image"] == "data:image/png;base64,AAA"
    assert "image2" not in p  # None values dropped


def test_parse_image_response():
    data = {"images": [{"url": "https://x/a.png"}, {"url": "https://x/b.png"}], "seed": 99}
    urls, seed = parse_image_response(data)
    assert urls == ["https://x/a.png", "https://x/b.png"]
    assert seed == 99


def test_parse_image_response_empty():
    urls, seed = parse_image_response({})
    assert urls == []
    assert seed is None
