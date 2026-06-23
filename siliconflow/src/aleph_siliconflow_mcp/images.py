"""Image generation and editing tools (POST /v1/images/generations)."""

from __future__ import annotations

from .client import get_client, render_assets, to_image_field
from .ratios import image_size_for


def build_image_payload(
    *,
    prompt: str,
    model: str,
    image_size: str | None = None,
    negative_prompt: str | None = None,
    batch_size: int = 1,
    seed: int | None = None,
    num_inference_steps: int = 20,
    guidance_scale: float | None = None,
    cfg: float | None = None,
    images: dict | None = None,
) -> dict:
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "batch_size": batch_size,
        "num_inference_steps": num_inference_steps,
    }
    if image_size:
        payload["image_size"] = image_size
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt
    if seed is not None:
        payload["seed"] = seed
    if guidance_scale is not None:
        payload["guidance_scale"] = guidance_scale
    if cfg is not None:
        payload["cfg"] = cfg
    for key, value in (images or {}).items():
        if value:
            payload[key] = value
    return payload


def parse_image_response(data: dict) -> tuple[list[str], int | None]:
    urls = [img["url"] for img in data.get("images", []) if img.get("url")]
    return urls, data.get("seed")


async def generate_image(
    prompt: str,
    model: str = "Kwai-Kolors/Kolors",
    aspect_ratio: str = "1:1",
    negative_prompt: str | None = None,
    batch_size: int = 1,
    seed: int | None = None,
    num_inference_steps: int = 20,
    guidance_scale: float | None = None,
    cfg: float | None = None,
) -> str:
    """Generate image(s) from a text prompt via SiliconFlow. Returns local paths and URLs."""
    client = get_client()
    payload = build_image_payload(
        prompt=prompt,
        model=model,
        image_size=image_size_for(aspect_ratio),
        negative_prompt=negative_prompt,
        batch_size=batch_size,
        seed=seed,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        cfg=cfg,
    )
    data = await client.request_json("POST", "/images/generations", json=payload)
    urls, out_seed = parse_image_response(data)
    header = f"Generated {len(urls)} image(s) with {model} (seed={out_seed})"
    return await render_assets(client, "image", urls, client.settings.image_dir, "image", header)


async def edit_image(
    prompt: str,
    image: str,
    model: str = "Qwen/Qwen-Image-Edit-2509",
    image2: str | None = None,
    image3: str | None = None,
    negative_prompt: str | None = None,
    seed: int | None = None,
) -> str:
    """Edit / transform an image (local path or URL) with a text instruction."""
    client = get_client()
    images = {"image": to_image_field(image)}
    if image2:
        images["image2"] = to_image_field(image2)
    if image3:
        images["image3"] = to_image_field(image3)
    payload = build_image_payload(
        prompt=prompt, model=model, negative_prompt=negative_prompt, seed=seed, images=images
    )
    data = await client.request_json("POST", "/images/generations", json=payload)
    urls, out_seed = parse_image_response(data)
    header = f"Edited image with {model} (seed={out_seed})"
    return await render_assets(client, "image", urls, client.settings.image_dir, "edit", header)
