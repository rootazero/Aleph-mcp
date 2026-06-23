# Design: Rewrite `aleph-siliconflow-mcp` Python → TypeScript

**Date:** 2026-06-23
**Status:** Approved (brainstorming) — ready for implementation plan
**Repo:** `Aleph-mcp` (`siliconflow/` package)
**Coupled repo:** `Aleph` main (`src/mcp/presets/catalog.json` — one separated commit)

---

## 1. Goal & scope

Replace the Python FastMCP server with a **behaviorally identical** TypeScript MCP
server, distributed on **npm**, launched via **`npx -y aleph-siliconflow-mcp@<ver>`**.
Same 8 tools, same environment variables, same LLM-facing contract (tool names,
parameters, defaults, descriptions, output text). The Python source is **deleted** —
TypeScript becomes the only implementation and the repo converges to a single TS stack.

**Why:** MCP's reference SDK is TypeScript (`@modelcontextprotocol/sdk`); the most-installed
public servers ship as `npx` packages (e.g. `@upstash/context7-mcp`); for a thin HTTP+JSON
wrapper with no ML/native processing, Python offers zero advantage, so the swap is
zero-functionality-loss. The Aleph catalog already runs node-based presets
(`context7`, `amap`) via `npx … requires_runtime: node`, so the runtime mechanism already
supports this.

### In scope
- TS rewrite of all 8 tools + shared client/helpers.
- Port the pure-function test suite to vitest.
- `package.json` + `tsc` build + `bin` entrypoint.
- CI workflow (typecheck + tests) and publish workflow (npm, OIDC provenance).
- Rewrite root `README.md` and `siliconflow/README.md` (uv/uvx → Node/npx).
- Delete all Python artifacts.
- Repoint Aleph main-repo `catalog.json` (separated commit).
- Note the PyPI `0.1.0` yank (manual step).

### Not changing
- Environment variable names and semantics.
- SiliconFlow API endpoints, payloads, and behavior.
- `.env.example`, `LICENSE`.
- The Aleph Rust core — the `node` runtime probe already exists
  (`src/mcp/external/runtime.rs`); **zero Rust changes**.

### Confirmed decisions
- **Full replace** (delete Python, TS only).
- **npm package name** `aleph-siliconflow-mcp` (unscoped; verified available — npm returns 404).
- **Version `0.2.0`** for npm + git tag `v0.2.0` (`v0.1.0` is taken by the Python release;
  the bump signals the runtime swap).
- **Catalog edit included** in this plan, as a clearly-separated step in the main repo.

---

## 2. Architecture & module map

Mirror the Python layout 1:1 so the change is reviewable as a like-for-like port and the
unit boundaries are preserved.

| TS file | Replaces | Responsibility |
|---|---|---|
| `src/index.ts` | `main.py` + `server.py` | `#!/usr/bin/env node` shebang; construct `McpServer`; register all tools; connect `StdioServerTransport`; `main()` |
| `src/client.ts` | `client.py` | `Settings.fromEnv`, `SiliconFlowClient` (`requestJson` / `requestBinary` / `download` / `saveBinary`), `extractApiError`, `extFromUrl` / `buildFilename` / `looksRemote` / `toImageField`, `renderAssets`, lazy `getClient()` singleton |
| `src/ratios.ts` | `ratios.py` | `IMAGE_SIZES` / `VIDEO_SIZES` maps, `imageSizeFor` / `videoSizeFor` |
| `src/images.ts` | `images.py` | `buildImagePayload`, `parseImageResponse`, `generateImage`, `editImage` + their tool defs |
| `src/videos.ts` | `videos.py` | `buildVideoPayload`, `parseSubmitResponse`, `parseStatusResponse`, `submitVideoGeneration`, `getVideoStatus`, `generateVideo` + tool defs |
| `src/audio.ts` | `audio.py` | `buildSpeechPayload`, `extForFormat`, `generateSpeech` + tool def |
| `src/user.ts` | `user.py` | `parseUserInfo`, `parseModelList`, `getUserInfo`, `listModels` + tool defs |

### Tool wiring pattern

Each domain module exports its tool definitions as an array of
`{ name, config, handler }` objects — Zod schema and handler co-located with the domain
logic (the FastMCP equivalent of `mcp.tool()(images.generate_image)`). `index.ts` imports
those arrays and calls `server.registerTool(name, config, handler)` for each. This keeps
domain modules cohesive and `index.ts` thin. Pure helper functions remain separately
exported (not closed over a tool handler) so they can be unit-tested directly, exactly as
in the Python version.

### Error handling

Port `SiliconFlowError` as a TS `Error` subclass. Tool handlers throw it on API/IO failure;
the SDK surfaces a thrown error as an error tool-result (mirrors FastMCP). Verify the exact
SDK surfacing behavior against `@modelcontextprotocol/sdk@1.29` during implementation; if
the SDK requires an explicit `{ isError: true, content: [...] }` shape, wrap at the handler
boundary.

---

## 3. Tool-contract parity (must be exact)

FastMCP auto-derived JSON Schema from Python type hints + docstrings. In TS this becomes
**explicit Zod shapes** — the only place TS is more verbose. Each tool's parameter names,
defaults, optionality, enums, and `.describe()` text reproduce the Python signatures and
docstrings verbatim, so the model sees an identical interface. Output strings
(`renderAssets` formatting, balances block, model list, status messages) are ported
byte-for-byte.

The 8 tools and their parameter contracts (from the Python source — reproduce exactly):

1. **`generate_image`** — `prompt: string`, `model="Kwai-Kolors/Kolors"`,
   `aspect_ratio` ∈ `{1:1,3:4,4:3,9:16,16:9}` default `1:1`, `negative_prompt?`,
   `batch_size=1`, `seed?`, `num_inference_steps=20`, `guidance_scale?`, `cfg?`.
   → POST `/images/generations`; render images to `image_dir`.
2. **`edit_image`** — `prompt: string`, `image: string` (path or URL),
   `model="Qwen/Qwen-Image-Edit-2509"`, `image2?`, `image3?`, `negative_prompt?`, `seed?`.
   → `toImageField` each input (passthrough URL/data-URI; base64-encode local file);
   POST `/images/generations`.
3. **`generate_video`** — `prompt: string`, `model="Wan-AI/Wan2.2-T2V-A14B"`,
   `aspect_ratio` ∈ `{16:9,9:16,1:1}` default `16:9`, `image?`, `negative_prompt?`, `seed?`,
   `max_wait_seconds=600`, `poll_interval_seconds=5`. → submit + poll loop until
   Succeed/Failed/timeout.
4. **`submit_video_generation`** — same submit params (no poll args); returns `requestId`.
5. **`get_video_status`** — `request_id: string`; POST `/video/status`; render on Succeed.
6. **`generate_speech`** — `input: string`, `model="FunAudioLLM/CosyVoice2-0.5B"`,
   `voice?` (`model:voice_id`), `response_format="mp3"`, `speed=1.0`, `gain=0.0`.
   → POST `/audio/speech` (binary); save to `audio_dir`.
7. **`list_models`** — `type?` (`text|image|audio|video`), `sub_type?`. → GET `/models`.
8. **`get_user_info`** — no params. → GET `/user/info`; format balances.

Aspect-ratio maps (`ratios.ts`): images `1:1→1024x1024, 3:4→768x1024, 4:3→1024x768,
9:16→576x1024, 16:9→1024x576`; videos `16:9→1280x720, 9:16→720x1280, 1:1→960x960`.
Unknown ratio → thrown error listing allowed values (port the message text).

---

## 4. Stack & build

### Runtime dependencies
- `@modelcontextprotocol/sdk` (`^1.29`) — high-level `McpServer` + `StdioServerTransport`.
- `zod` — tool input schemas.
- **Native `fetch`** for HTTP (Node 18+) — no axios / node-fetch.
- **No `dotenv` dependency.** MCP clients inject env over stdio; local dev uses
  `node --env-file=.env`. (Matches Aleph R3 core-minimalism.)

### Module format & build
- ESM: `"type": "module"`.
- `tsc` compiles `src/` → `dist/` (no bundler; thin wrapper doesn't need one).
- `"bin": { "aleph-siliconflow-mcp": "dist/index.js" }`; `dist/index.js` starts with
  `#!/usr/bin/env node`.
- `"files": ["dist"]`, `"engines": { "node": ">=18" }`.
- `"scripts"`: `build` (tsc), `prepare`/`prepublishOnly` (build before publish),
  `typecheck` (`tsc --noEmit`), `test` (`vitest run`).
- Dev deps: `typescript`, `vitest`, `@types/node`. (Optional `prettier`; eslint omitted
  unless requested.)
- `tsconfig.json`: `module`/`moduleResolution` = `NodeNext`, `target` ES2022,
  `outDir dist`, `rootDir src`, `strict: true`, `declaration` optional.

---

## 5. Testing (vitest)

Port the existing pure-function suite 1:1 (~280 LOC Python → equivalent vitest specs):

- **`ratios`** — known image/video ratios; unknown → throws with "aspect_ratio".
- **`client`** — `Settings.fromEnv` (defaults; audio-dir falls back to image-dir;
  `api_base` trailing-slash stripped; api_key trimmed); `extractApiError` (JSON `message`
  vs plain text); `extFromUrl`; `buildFilename`; `looksRemote`; `toImageField`
  (URL passthrough; missing file throws "not found"; local file → base64 data URI via tmp dir).
- **`images` / `videos` / `audio` / `user`** — `build*Payload` shape (conditional fields
  only when set) and `parse*Response` parsers.
- **`index`/registration** — assert all 8 tools are registered on the server.

Network tool bodies remain untested (same as the Python version — no HTTP mocking exists
today). Out of scope for this rewrite; could be added later with a fetch mock.

---

## 6. Packaging & publish

- **Version `0.2.0`**; git tag `v0.2.0`.
- `.github/workflows/ci.yml`: `actions/setup-node` → `npm ci` → `npm run typecheck`
  → `npm test` (`vitest run`). Working directory `siliconflow`.
- `.github/workflows/publish.yml`: on GitHub Release (`types: [published]`) →
  `npm publish --provenance --access public` using **npm Trusted Publishing (OIDC)**
  (`id-token: write`), mirroring the current no-stored-token PyPI approach. Fallback if
  OIDC trusted publishing isn't configured: `NODE_AUTH_TOKEN` from an `NPM_TOKEN` secret.
  Working directory `siliconflow`.

---

## 7. Catalog, README, and cleanup

### Aleph main repo — `src/mcp/presets/catalog.json` (separated commit)
Swap the single `siliconflow` stdio transport object:
```json
{ "kind": "stdio", "command": "npx", "args": ["-y", "aleph-siliconflow-mcp@0.2.0"], "requires_runtime": "node" }
```
Everything else in the entry (`id`, `required_env`, `tags`, …) is unchanged. Pinning
`@0.2.0` matches the current convention (the Python entry pinned `@0.1.0`); a floating
`aleph-siliconflow-mcp` is the documented alternative.

### README rewrites (Aleph-mcp)
- Root `README.md` and `siliconflow/README.md`: prerequisites uv → Node 18+/npx;
  all install examples (Aleph preset / Claude Code / generic JSON) uvx → npx; dev commands
  (`npm ci`, `npm test`, `npm run build`); note the package moved from PyPI to npm.

### Deletions (Aleph-mcp)
- `siliconflow/src/aleph_siliconflow_mcp/` (all `.py`)
- `siliconflow/tests/*.py`
- `siliconflow/pyproject.toml`, `siliconflow/uv.lock`
- `siliconflow/dist/*.whl`, `*.tar.gz`
- `siliconflow/.ruff_cache`, `.pytest_cache`, `.venv`
- Update `siliconflow/.gitignore` (add `node_modules/`, `dist/`; drop Python entries).
- Keep `siliconflow/.env.example`, `LICENSE`.

### Manual step
- Yank PyPI `aleph-siliconflow-mcp 0.1.0` via the PyPI web UI ("yank release"); README
  points users to npm.

---

## 8. Risks & verification

- **Contract drift** — any deviation in tool param names/defaults/descriptions changes the
  model-facing interface. Mitigation: port from the Python source field-by-field; the
  registration test plus a manual `tools/list` diff against the Python server confirm parity.
- **SDK error surfacing** — confirm thrown-error behavior against `@modelcontextprotocol/sdk@1.29`
  during implementation; wrap to `{ isError: true }` at the boundary if needed.
- **npm publish auth** — OIDC trusted publishing is the target; token fallback documented.
- **End-to-end** — after publish: `npx -y aleph-siliconflow-mcp@0.2.0` launches and responds
  to `tools/list` with the 8 tools; Aleph install via the repointed catalog succeeds (the
  `node` runtime probe is already in place).

---

## 9. Success criteria

1. `npm run typecheck` and `npm test` pass; vitest covers the same pure-function surface as
   the Python suite plus tool registration.
2. `npm pack` produces a package whose `bin` runs under `npx` and serves all 8 tools over
   stdio with parameter schemas matching the Python server.
3. No Python artifacts remain in the repo; READMEs describe the Node/npx workflow only.
4. Aleph main-repo `catalog.json` points siliconflow at `npx … requires_runtime: node`;
   installing the preset in Aleph works end-to-end.
5. Published to npm as `aleph-siliconflow-mcp@0.2.0` via the Release workflow; PyPI 0.1.0 yanked.
