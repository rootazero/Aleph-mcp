/** Text-to-speech tool (POST /v1/audio/speech). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient } from "./client.js";

const AUDIO_EXTENSIONS = new Set(["mp3", "opus", "wav", "pcm"]);

export interface SpeechPayloadOpts {
  input: string;
  model: string;
  voice?: string;
  responseFormat?: string;
  speed?: number;
  gain?: number;
}

export function buildSpeechPayload(o: SpeechPayloadOpts): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: o.model,
    input: o.input,
    response_format: o.responseFormat ?? "mp3",
    speed: o.speed ?? 1.0,
    gain: o.gain ?? 0.0,
    stream: false,
  };
  if (o.voice) payload.voice = o.voice;
  return payload;
}

export function extForFormat(responseFormat: string): string {
  return AUDIO_EXTENSIONS.has(responseFormat) ? responseFormat : "mp3";
}

async function generateSpeech(args: Record<string, any>) {
  const client = getClient();
  const payload = buildSpeechPayload({
    input: args.input,
    model: args.model,
    voice: args.voice,
    responseFormat: args.response_format,
    speed: args.speed,
    gain: args.gain,
  });
  const content = await client.requestBinary("POST", "/audio/speech", { json: payload });
  const saveDir = client.settings.audioDir;
  if (!saveDir) {
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Generated ${content.length} bytes of ${args.response_format} audio, but no save dir is set. ` +
            "Set SILICONFLOW_AUDIO_DIR (or SILICONFLOW_IMAGE_DIR) to save it.",
        },
      ],
    };
  }
  const path = client.saveBinary(content, saveDir, extForFormat(args.response_format), "speech");
  return { content: [{ type: "text" as const, text: `Generated speech with ${args.model}: ${path}` }] };
}

export const audioTools: ToolDef[] = [
  {
    name: "generate_speech",
    description: "Synthesize speech from text. voice format is 'model:voice_id'. Returns the saved path.",
    inputSchema: {
      input: z.string(),
      model: z.string().default("FunAudioLLM/CosyVoice2-0.5B"),
      voice: z.string().optional(),
      response_format: z.string().default("mp3"),
      speed: z.number().default(1.0),
      gain: z.number().default(0.0),
    },
    handler: generateSpeech,
  },
];
