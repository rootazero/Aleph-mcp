# aleph-t8star-mcp

Aleph's official MCP server for **T8star** (`ai.t8star.org`) — a large OpenAI/Anthropic-compatible model relay. This MCP exposes **media-generation** tools only; chat models are used through Aleph's Provider system (add t8star as an OpenAI-compatible provider).

## Tools

| Tool | What it does |
|------|--------------|
| `generate_image` | Text-to-image (`gpt-image-2`, `dall-e-3`, `flux-2-pro`, `nano-banana-2`, …) |
| `edit_image` | Edit an image with a text instruction (OpenAI `/v1/images/edits`) |
| `generate_speech` | Text-to-speech (`tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`, …) |
| `list_models` | List/filter the 800+ available models |
| `get_balance` | Account spend / quota (USD) |

> Model names are accurate as of 2026-06-23; use `list_models` to discover current models. Video / Midjourney / Suno are planned follow-ups.

## Configuration (env)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `T8STAR_API_KEY` | yes | — | from <https://ai.t8star.org> |
| `T8STAR_API_BASE` | no | `https://ai.t8star.org/v1` | `.cn` mirror also works |
| `T8STAR_IMAGE_DIR` | no | — | local dir to save images (URLs expire; some models return base64 which must be saved) |
| `T8STAR_AUDIO_DIR` | no | falls back to image dir | local dir to save audio |

## Install

**Aleph Panel (recommended):** Settings → MCP → install the `T8star 中转` preset → paste your API key.

**Claude Code CLI:**
```bash
claude mcp add t8star -e T8STAR_API_KEY="sk-..." -e T8STAR_IMAGE_DIR="/path/to/save" -- npx -y aleph-t8star-mcp@0.1.0
```

**Any MCP client (JSON):**
```json
{
  "mcpServers": {
    "t8star": {
      "command": "npx",
      "args": ["-y", "aleph-t8star-mcp@0.1.0"],
      "env": { "T8STAR_API_KEY": "sk-...", "T8STAR_IMAGE_DIR": "/path/to/save" }
    }
  }
}
```

## License

MIT — see the repository [LICENSE](../LICENSE).
