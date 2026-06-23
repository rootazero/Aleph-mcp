// Text-to-speech tool (POST /v1/audio/speech, OpenAI-compatible).
import { extForFormat, getClient } from "./client.js";

export interface SpeechParams {
  input: string;
  model: string;
  voice?: string | null;
  responseFormat?: string;
  speed?: number;
}

export function buildSpeechPayload(p: SpeechParams): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: p.model,
    input: p.input,
    response_format: p.responseFormat ?? "mp3",
    speed: p.speed ?? 1.0,
  };
  if (p.voice) payload.voice = p.voice;
  return payload;
}

export async function generateSpeech(args: {
  input: string;
  model?: string;
  voice?: string;
  response_format?: string;
  speed?: number;
}): Promise<string> {
  const client = getClient();
  const model = args.model ?? "tts-1";
  const responseFormat = args.response_format ?? "mp3";
  const payload = buildSpeechPayload({
    input: args.input,
    model,
    voice: args.voice ?? "alloy",
    responseFormat,
    speed: args.speed ?? 1.0,
  });
  const content = await client.requestBinary("POST", "/audio/speech", { json: payload });
  const saveDir = client.settings.audioDir;
  if (!saveDir) {
    return (
      `Generated ${content.length} bytes of ${responseFormat} audio, but no save dir is set. ` +
      "Set T8STAR_AUDIO_DIR (or T8STAR_IMAGE_DIR) to save it."
    );
  }
  const path = client.saveBinary(content, saveDir, extForFormat(responseFormat), "speech");
  return `Generated speech with ${model}: ${path}`;
}
