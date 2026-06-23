# SiliconFlow MCP (aleph-siliconflow-mcp)

Aleph's official SiliconFlow media-generation MCP server: **image / video / TTS**.
Aleph 官方的硅基流动多媒体生成 MCP 服务（图片 / 视频 / 语音合成）。

SiliconFlow ships no official MCP, so Aleph builds one. Text chat / embedding / rerank
are already handled by Aleph core, so this server is **media-only**.

---

## Prerequisites / 前置要求

1. **[uv](https://docs.astral.sh/uv/)** installed (provides `uvx`):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh   # macOS / Linux
   # Windows: powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
   ```
   `uvx` builds and launches the server on demand — no manual `pip install` needed.
2. A **SiliconFlow API key** — get one at <https://cloud.siliconflow.cn/account/ak>.

---

## Installation / 安装

### Option A — In Aleph (recommended) / 在 Aleph 中（推荐）

This server is a **built-in MCP preset** in Aleph (alongside 高德地图 / 火山引擎 veImageX /
MiniMax / Context7). No manual config needed:

1. Open the Aleph **Panel → Settings → MCP** (设置 → MCP).
2. Find **硅基流动 SiliconFlow** in the preset catalog and click **Install / 安装**.
3. Paste your **API key** (and optionally a save directory for images/audio).
4. Done — the tools become available to Aleph immediately.

> You can also just **ask Aleph in natural language**, e.g. “装一下硅基流动 MCP / install the
> SiliconFlow MCP”, and Aleph will run the install for you (it will ask for the API key).

### Option B — Claude Code / 其他支持 MCP 的客户端（CLI）

```bash
claude mcp add siliconflow \
  -e SILICONFLOW_API_KEY="your_api_key_here" \
  -e SILICONFLOW_IMAGE_DIR="/path/to/save" \
  -- uvx aleph-siliconflow-mcp@0.1.0
```

### Option C — Claude Desktop / any MCP client (JSON) / 通用 JSON 配置

Add this to your client's MCP config
(Claude Desktop: `claude_desktop_config.json`; others: their `mcpServers` block):

```json
{
  "mcpServers": {
    "siliconflow": {
      "command": "uvx",
      "args": ["aleph-siliconflow-mcp@0.1.0"],
      "env": {
        "SILICONFLOW_API_KEY": "your_api_key_here",
        "SILICONFLOW_IMAGE_DIR": "/path/to/save"
      }
    }
  }
}
```

> **Pinned vs latest / 固定版本与最新版**: `aleph-siliconflow-mcp@0.1.0` pins a reproducible
> release from [PyPI](https://pypi.org/project/aleph-siliconflow-mcp/) (recommended); use
> `aleph-siliconflow-mcp` (no `@version`) to always get the latest. Installing straight from the
> git repo also works:
> `uvx --from "git+https://github.com/rootazero/Aleph-mcp@v0.1.0#subdirectory=siliconflow" aleph-siliconflow-mcp`.
> The first launch downloads + caches the package (a few seconds).

---

## Configuration / 配置

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SILICONFLOW_API_KEY` | Yes | — | SiliconFlow API key |
| `SILICONFLOW_API_BASE` | No | `https://api.siliconflow.cn/v1` | Override API endpoint (use `.com` for overseas) |
| `SILICONFLOW_IMAGE_DIR` | No | — | Local directory to save generated images and videos |
| `SILICONFLOW_AUDIO_DIR` | No | `SILICONFLOW_IMAGE_DIR` | Local directory to save generated audio |

> **Note / 注意:** Generated media URLs expire quickly — images within ~1 hour, videos sooner.
> Set `SILICONFLOW_IMAGE_DIR` to save assets locally and avoid losing them.
> 生成的媒体 URL 很快过期（图片约 1 小时，视频更短），建议设置保存目录以本地留存。

---

## Tools / 工具

| Tool | Description |
|------|-------------|
| `generate_image` | Generate an image from a text prompt using a SiliconFlow image model |
| `edit_image` | Edit or transform an existing image (img2img) using a text prompt |
| `generate_video` | Submit a video generation job and poll until it completes (synchronous) |
| `submit_video_generation` | Submit a video generation job and return immediately with a request ID |
| `get_video_status` | Poll the status of a previously submitted video generation job |
| `generate_speech` | Convert text to speech (TTS); `voice` is `model:voice_id` |
| `list_models` | List available models (`type`: image / video / audio / text; `sub_type`: text-to-image, text-to-video, speech-to-text, …) |
| `get_user_info` | Retrieve account info and credit balance (total / charged / gift) |

---

## Development / 开发

```bash
cd siliconflow
uv run --extra dev pytest        # run the test suite
uvx ruff check .                 # lint
uv build                         # build sdist + wheel
```

License: MIT.
