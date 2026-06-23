# SiliconFlow MCP (aleph-siliconflow-mcp)

Aleph's official SiliconFlow media-generation MCP server: image / video / TTS.

## Tools

| Tool | Description |
|------|-------------|
| `generate_image` | Generate an image from a text prompt using a SiliconFlow image model |
| `edit_image` | Edit or transform an existing image (img2img) using a text prompt |
| `generate_video` | Submit a video generation job and poll until it completes (synchronous) |
| `submit_video_generation` | Submit a video generation job and return immediately with a request ID |
| `get_video_status` | Poll the status of a previously submitted video generation job |
| `generate_speech` | Convert text to speech (TTS) using a SiliconFlow audio model |
| `list_models` | List available models for a given type (image, video, audio, text, etc.) |
| `get_user_info` | Retrieve account information and remaining credit balance |

## Configuration

Get your API key at <https://cloud.siliconflow.cn/account/ak>.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SILICONFLOW_API_KEY` | Yes | — | SiliconFlow API key |
| `SILICONFLOW_API_BASE` | No | `https://api.siliconflow.cn/v1` | Override API endpoint (use `.com` for overseas) |
| `SILICONFLOW_IMAGE_DIR` | No | — | Local directory to save generated images and videos |
| `SILICONFLOW_AUDIO_DIR` | No | `SILICONFLOW_IMAGE_DIR` | Local directory to save generated audio |

> **Note:** Generated media URLs expire quickly — images within ~1 hour, videos sooner.
> Set `SILICONFLOW_IMAGE_DIR` to save assets locally and avoid losing them.

## Usage (MCP client config)

```json
{
  "mcpServers": {
    "siliconflow": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/rootazero/Aleph-mcp#subdirectory=siliconflow", "aleph-siliconflow-mcp"],
      "env": { "SILICONFLOW_API_KEY": "your_api_key_here", "SILICONFLOW_IMAGE_DIR": "/path/to/save" }
    }
  }
}
```
