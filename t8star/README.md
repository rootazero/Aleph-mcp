# aleph-t8star-mcp

Aleph's official MCP server for **T8star** (`ai.t8star.org`) — a large OpenAI/Anthropic-compatible model relay. This MCP exposes **media-generation** tools only; chat models are used through Aleph's Provider system (add t8star as an OpenAI-compatible provider).

## Tools

| Tool | What it does |
|------|--------------|
| `generate_image` | Text-to-image (`gpt-image-2`, `dall-e-3`, `flux-2-pro`, `nano-banana-2`, …) |
| `edit_image` | Edit an image synchronously (OpenAI `/v1/images/edits`). |
| `edit_image_async` | Submit an edit asynchronously, returns `task_id` immediately. Use `get_edit` to poll. |
| `get_edit` | Poll an async image edit task by `task_id`. |
| `generate_flux` | Generate image via BFL Flux 2 (`flux-2-max`, `flux-2-pro`, `flux-2-flex`). Supports reference image. |
| `get_flux` | Poll a Flux 2 task by `task_id`. |
| `generate_speech` | Text-to-speech (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`, …) |
| `generate_video` | Text-to-video (T2V) or image-to-video (I2V). Models: `sora_video2`, `veo3`, `veo3-fast`, `veo3-pro`, `wan-3.0-{i2v,r2v,global}`, `hailuo-h3-*`, `seedance-*`, `kling`, `minimax-h3-ow-*`. Submits `/v1/videos`, polls until done, saves the MP4. |
| `get_video` | Poll a previously submitted video task by `task_id`. |
| `generate_music` | Generate music via Suno (`/suno/generate` + `/suno/feed`). Returns up to 2 audio clips saved to `T8STAR_MUSIC_DIR`. |
| `generate_lyrics` | Generate song lyrics via Suno (`/suno/generate/lyrics/` + `/suno/lyrics/{id}`). |
| `imagine_mj` | Submit a Midjourney imagine task; returns `task_id` + U1-U4 / V1-V4 button list. |
| `mj_action` | Trigger a Midjourney button by `customId` (upscale one / variation of one). |
| `get_mj` | Poll a Midjourney task by `task_id`. |
| `list_models` | List/filter the 800+ available models |
| `get_balance` | Account spend / quota (USD) |

> Model names are accurate as of 2026-10-08; use `list_models` to discover current models. All mainstream media-generation APIs t8star exposes are covered as of 0.4.0. Chat models remain accessed via Aleph's Provider system — not exposed here.

## Configuration (env)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `T8STAR_API_KEY` | yes | — | from <https://ai.t8star.org> |
| `T8STAR_API_BASE` | no | `https://ai.t8star.org/v1` | `.cn` mirror also works |
| `T8STAR_IMAGE_DIR` | no | — | local dir to save images (URLs expire; some models return base64 which must be saved) |
| `T8STAR_AUDIO_DIR` | no | falls back to image dir | local dir to save audio |
| `T8STAR_VIDEO_DIR` | no | — | local dir to save generated MP4s |
| `T8STAR_MUSIC_DIR` | no | falls back to `T8STAR_AUDIO_DIR` | local dir to save Suno clips |
| `T8STAR_VIDEO_POLL_INTERVAL_MS` | no | `5000` | how often to poll `/v1/videos/{id}` and `/suno/feed/{ids}` |
| `T8STAR_VIDEO_POLL_TIMEOUT_MS` | no | `1200000` (20 min) | give up after this; videos can be slow |

## Install

**Aleph Panel (recommended):** Settings → MCP → install the `T8star 中转` preset → paste your API key.

**Claude Code CLI:**
```bash
claude mcp add t8star -e T8STAR_API_KEY="sk-..." -e T8STAR_IMAGE_DIR="/path/to/save" -e T8STAR_VIDEO_DIR="/path/to/videos" -e T8STAR_MUSIC_DIR="/path/to/music" -- npx -y aleph-t8star-mcp@0.4.0
```

**Any MCP client (JSON):**
```json
{
  "mcpServers": {
    "t8star": {
      "command": "npx",
      "args": ["-y", "aleph-t8star-mcp@0.4.0"],
      "env": {
        "T8STAR_API_KEY": "sk-...",
        "T8STAR_IMAGE_DIR": "/path/to/save",
        "T8STAR_VIDEO_DIR": "/path/to/videos",
        "T8STAR_MUSIC_DIR": "/path/to/music"
      }
    }
  }
}
```

## License

MIT — see the repository [LICENSE](../LICENSE).
