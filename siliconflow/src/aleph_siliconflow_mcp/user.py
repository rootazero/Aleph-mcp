"""Account + model-discovery tools (GET /v1/user/info, GET /v1/models)."""

from __future__ import annotations

from .client import get_client


def parse_user_info(data: dict) -> dict:
    d = data.get("data", data)
    return {
        "name": d.get("name"),
        "email": d.get("email"),
        "total_balance": d.get("totalBalance"),
        "charge_balance": d.get("chargeBalance"),
        "gift_balance": d.get("balance"),
    }


def parse_model_list(data: dict) -> list[str]:
    return [m["id"] for m in data.get("data", []) if m.get("id")]


async def get_user_info() -> str:
    """Show the SiliconFlow account profile and balances (total / charged / gift)."""
    client = get_client()
    data = await client.request_json("GET", "/user/info")
    info = parse_user_info(data)
    return (
        "SiliconFlow account:\n"
        f"  name: {info['name']}\n"
        f"  email: {info['email']}\n"
        f"  total balance: {info['total_balance']}\n"
        f"  charged: {info['charge_balance']}  gift: {info['gift_balance']}"
    )


async def list_models(type: str | None = None, sub_type: str | None = None) -> str:
    """List available models. type: text|image|audio|video; sub_type: e.g. text-to-image, image-to-image, text-to-video, speech-to-text."""
    client = get_client()
    params: dict = {}
    if type:
        params["type"] = type
    if sub_type:
        params["sub_type"] = sub_type
    data = await client.request_json("GET", "/models", params=params or None)
    models = parse_model_list(data)
    if not models:
        return "No models found."
    return "Available models:\n" + "\n".join(f"  - {m}" for m in models)
