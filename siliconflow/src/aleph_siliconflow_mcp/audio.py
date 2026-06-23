"""Text-to-speech tool (POST /v1/audio/speech)."""

from __future__ import annotations

from .client import get_client

_AUDIO_EXTENSIONS = {"mp3", "opus", "wav", "pcm"}


def build_speech_payload(
    *,
    input: str,
    model: str,
    voice: str | None = None,
    response_format: str = "mp3",
    speed: float = 1.0,
    gain: float = 0.0,
) -> dict:
    payload: dict = {
        "model": model,
        "input": input,
        "response_format": response_format,
        "speed": speed,
        "gain": gain,
        "stream": False,
    }
    if voice:
        payload["voice"] = voice
    return payload


def ext_for_format(response_format: str) -> str:
    return response_format if response_format in _AUDIO_EXTENSIONS else "mp3"


async def generate_speech(
    input: str,
    model: str = "FunAudioLLM/CosyVoice2-0.5B",
    voice: str | None = None,
    response_format: str = "mp3",
    speed: float = 1.0,
    gain: float = 0.0,
) -> str:
    """Synthesize speech from text. voice format is 'model:voice_id'. Returns the saved path."""
    client = get_client()
    payload = build_speech_payload(
        input=input, model=model, voice=voice,
        response_format=response_format, speed=speed, gain=gain,
    )
    content = await client.request_binary("POST", "/audio/speech", json=payload)
    save_dir = client.settings.audio_dir
    if not save_dir:
        return (
            f"Generated {len(content)} bytes of {response_format} audio, but no save dir is set. "
            "Set SILICONFLOW_AUDIO_DIR (or SILICONFLOW_IMAGE_DIR) to save it."
        )
    path = client.save_binary(content, save_dir, ext_for_format(response_format), "speech")
    return f"Generated speech with {model}: {path}"
