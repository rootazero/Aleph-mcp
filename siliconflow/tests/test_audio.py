from aleph_siliconflow_mcp.audio import build_speech_payload, ext_for_format


def test_build_speech_payload_defaults():
    p = build_speech_payload(input="hello", model="FunAudioLLM/CosyVoice2-0.5B")
    assert p == {
        "model": "FunAudioLLM/CosyVoice2-0.5B",
        "input": "hello",
        "response_format": "mp3",
        "speed": 1.0,
        "gain": 0.0,
        "stream": False,
    }


def test_build_speech_payload_with_voice():
    p = build_speech_payload(
        input="hi", model="m", voice="m:alex", response_format="wav", speed=1.5, gain=2.0
    )
    assert p["voice"] == "m:alex"
    assert p["response_format"] == "wav"
    assert p["speed"] == 1.5
    assert p["gain"] == 2.0


def test_ext_for_format():
    assert ext_for_format("wav") == "wav"
    assert ext_for_format("opus") == "opus"
    assert ext_for_format("unknown") == "mp3"
