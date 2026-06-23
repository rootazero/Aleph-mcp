"""Video generation tools (POST /v1/video/submit + /v1/video/status)."""

from __future__ import annotations

import asyncio

from .client import SiliconFlowError, get_client, render_assets, to_image_field
from .ratios import video_size_for


def build_video_payload(
    *,
    prompt: str,
    model: str,
    image_size: str,
    image: str | None = None,
    negative_prompt: str | None = None,
    seed: int | None = None,
) -> dict:
    payload: dict = {"model": model, "prompt": prompt, "image_size": image_size}
    if image:
        payload["image"] = image
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt
    if seed is not None:
        payload["seed"] = seed
    return payload


def parse_submit_response(data: dict) -> str:
    request_id = data.get("requestId")
    if not request_id:
        raise SiliconFlowError(f"unexpected video submit response: {data}")
    return request_id


def parse_status_response(data: dict) -> dict:
    results = data.get("results") or {}
    return {
        "status": data.get("status", "Unknown"),
        "reason": data.get("reason"),
        "urls": [v["url"] for v in results.get("videos", []) if v.get("url")],
    }


async def submit_video_generation(
    prompt: str,
    model: str = "Wan-AI/Wan2.2-T2V-A14B",
    aspect_ratio: str = "16:9",
    image: str | None = None,
    negative_prompt: str | None = None,
    seed: int | None = None,
) -> str:
    """Submit a video generation job; returns a requestId to poll with get_video_status."""
    client = get_client()
    payload = build_video_payload(
        prompt=prompt,
        model=model,
        image_size=video_size_for(aspect_ratio),
        image=to_image_field(image) if image else None,
        negative_prompt=negative_prompt,
        seed=seed,
    )
    data = await client.request_json("POST", "/video/submit", json=payload)
    request_id = parse_submit_response(data)
    return f"Video job submitted. requestId: {request_id}\nPoll with get_video_status."


async def get_video_status(request_id: str) -> str:
    """Check a video job's status; on success returns the saved path / URL."""
    client = get_client()
    data = await client.request_json("POST", "/video/status", json={"requestId": request_id})
    status = parse_status_response(data)
    if status["status"] == "Succeed":
        return await render_assets(
            client, "video", status["urls"], client.settings.image_dir, "video",
            f"Video ready (requestId {request_id})",
        )
    if status["status"] == "Failed":
        return f"Video generation failed: {status['reason'] or 'unknown reason'}"
    return f"Video status: {status['status']} (still processing). Poll again with requestId {request_id}."


async def generate_video(
    prompt: str,
    model: str = "Wan-AI/Wan2.2-T2V-A14B",
    aspect_ratio: str = "16:9",
    image: str | None = None,
    negative_prompt: str | None = None,
    seed: int | None = None,
    max_wait_seconds: int = 600,
    poll_interval_seconds: int = 5,
) -> str:
    """Generate a video and poll until done (with a timeout). Returns the saved path / URL."""
    client = get_client()
    payload = build_video_payload(
        prompt=prompt,
        model=model,
        image_size=video_size_for(aspect_ratio),
        image=to_image_field(image) if image else None,
        negative_prompt=negative_prompt,
        seed=seed,
    )
    submit = await client.request_json("POST", "/video/submit", json=payload)
    request_id = parse_submit_response(submit)
    waited = 0
    while waited < max_wait_seconds:
        await asyncio.sleep(poll_interval_seconds)
        waited += poll_interval_seconds
        data = await client.request_json("POST", "/video/status", json={"requestId": request_id})
        status = parse_status_response(data)
        if status["status"] == "Succeed":
            return await render_assets(
                client, "video", status["urls"], client.settings.image_dir, "video",
                f"Generated video with {model}",
            )
        if status["status"] == "Failed":
            return f"Video generation failed: {status['reason'] or 'unknown reason'}"
    return (
        f"Video still processing after {max_wait_seconds}s. "
        f"Poll later with get_video_status, requestId: {request_id}."
    )
