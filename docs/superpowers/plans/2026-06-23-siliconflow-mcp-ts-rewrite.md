# SiliconFlow MCP TypeScript Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Python FastMCP `aleph-siliconflow-mcp` server with a behaviorally identical TypeScript server distributed on npm and launched via `npx`.

**Architecture:** Mirror the Python module layout 1:1 in `siliconflow/src/*.ts`. Pure helpers (ratios, client helpers, payload builders, response parsers) are unit-tested with vitest; HTTP-calling handlers are thin and untested (as in Python). Each domain module exports a `ToolDef[]` (Zod input schema + handler co-located); `index.ts` is the only file that touches the MCP SDK registration API, so SDK coupling is isolated.

**Tech Stack:** TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk@^1.29`, `zod@^3`, native `fetch`, `tsc` build → `dist/`, vitest, GitHub Actions (CI + npm publish with provenance).

## Global Constraints

- **Package name:** `aleph-siliconflow-mcp` (unscoped). Verified available on npm.
- **Version:** `0.2.0`; git tag will be `v0.2.0` (`v0.1.0` belongs to the Python release).
- **Node floor:** `>=18` (native `fetch`). `package.json` `engines.node = ">=18"`.
- **Module system:** ESM (`"type": "module"`). **src→src relative imports MUST use `.js` extensions** (NodeNext requirement). **test→src imports omit the extension** (vitest resolves bare specifiers).
- **No dependencies beyond** `@modelcontextprotocol/sdk` + `zod` at runtime; `typescript` + `vitest` + `@types/node` at dev. No axios/node-fetch/dotenv. (Aleph R3 minimalism.)
- **Behavioral parity is the prime directive:** tool names, parameter names, types, defaults, optionality, and output strings are ported from the Python source verbatim. **Do NOT add parameter descriptions** — the Python tools used bare type hints, so FastMCP exposed no per-parameter descriptions; matching that keeps the model-facing schema identical. **Do NOT convert `aspect_ratio`/`response_format` to Zod enums** — Python typed them as free `str` and validated at runtime inside `imageSizeFor`/`videoSizeFor`/`extForFormat`; keep `z.string()` so the exact runtime error path is preserved.
- **Env vars (unchanged):** `SILICONFLOW_API_KEY` (required), `SILICONFLOW_API_BASE` (default `https://api.siliconflow.cn/v1`), `SILICONFLOW_IMAGE_DIR`, `SILICONFLOW_AUDIO_DIR` (falls back to image dir).
- **Working directory** for all package commands: `siliconflow/`.
- **Commit style:** `<scope>: <description>` (English), e.g. `feat: port ratios module to TypeScript`.

> **Known cosmetic divergence (accepted):** image/video headers render `seed=${outSeed}`; when the API omits a seed, TS shows `seed=undefined` where Python showed `seed=None`. The image/video APIs always return a seed in practice, so this path is not exercised. Do not special-case it.

---

### Task 1: Package scaffold + `ratios` module

**Files:**
- Create: `siliconflow/package.json`
- Create: `siliconflow/tsconfig.json`
- Create: `siliconflow/vitest.config.ts`
- Create: `siliconflow/.gitignore`
- Create: `siliconflow/src/tool-def.ts`
- Create: `siliconflow/src/ratios.ts`
- Test: `siliconflow/tests/ratios.test.ts`

**Interfaces:**
- Produces:
  - `interface ToolDef { name: string; description: string; inputSchema: ZodRawShape; handler: (args: Record<string, any>) => Promise<CallToolResult>; }` (in `tool-def.ts`)
  - `imageSizeFor(aspectRatio: string): string`
  - `videoSizeFor(aspectRatio: string): string`
  - constants `IMAGE_SIZES`, `VIDEO_SIZES`

- [ ] **Step 1: Create `siliconflow/package.json`**

```json
{
  "name": "aleph-siliconflow-mcp",
  "version": "0.2.0",
  "description": "Aleph's official SiliconFlow media-generation MCP server (image / video / TTS)",
  "type": "module",
  "bin": {
    "aleph-siliconflow-mcp": "dist/index.js"
  },
  "files": [
    "dist"
  ],
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "mcp",
    "siliconflow",
    "image",
    "video",
    "tts",
    "aleph"
  ],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `siliconflow/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": false,
    "sourceMap": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `siliconflow/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create `siliconflow/.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 5: Install dependencies (skip lifecycle scripts on first install)**

Run: `cd siliconflow && npm install --ignore-scripts`
Expected: `node_modules/` and `package-lock.json` created; no build runs (src is incomplete).

- [ ] **Step 6: Create `siliconflow/src/tool-def.ts`**

```ts
import type { ZodRawShape } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** A registrable MCP tool: name, description, Zod input shape, and async handler. */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (args: Record<string, any>) => Promise<CallToolResult>;
}
```

- [ ] **Step 7: Write the failing test `siliconflow/tests/ratios.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { imageSizeFor, videoSizeFor } from "../src/ratios";

describe("imageSizeFor", () => {
  it("maps known ratios", () => {
    expect(imageSizeFor("1:1")).toBe("1024x1024");
    expect(imageSizeFor("16:9")).toBe("1024x576");
    expect(imageSizeFor("9:16")).toBe("576x1024");
  });
  it("throws on unknown ratio", () => {
    expect(() => imageSizeFor("21:9")).toThrow(/aspect_ratio/);
  });
});

describe("videoSizeFor", () => {
  it("maps known ratios", () => {
    expect(videoSizeFor("16:9")).toBe("1280x720");
    expect(videoSizeFor("9:16")).toBe("720x1280");
    expect(videoSizeFor("1:1")).toBe("960x960");
  });
  it("throws on unknown ratio", () => {
    expect(() => videoSizeFor("4:3")).toThrow(/aspect_ratio/);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/ratios.test.ts`
Expected: FAIL — cannot resolve `../src/ratios`.

- [ ] **Step 9: Create `siliconflow/src/ratios.ts`**

```ts
/** Pure aspect-ratio → pixel-size mappings (no IO). */

export const IMAGE_SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "3:4": "768x1024",
  "4:3": "1024x768",
  "9:16": "576x1024",
  "16:9": "1024x576",
};

// Official video API accepts only these three sizes.
export const VIDEO_SIZES: Record<string, string> = {
  "16:9": "1280x720",
  "9:16": "720x1280",
  "1:1": "960x960",
};

export function imageSizeFor(aspectRatio: string): string {
  const size = IMAGE_SIZES[aspectRatio];
  if (size === undefined) {
    const allowed = Object.keys(IMAGE_SIZES).join(", ");
    throw new Error(`unsupported image aspect_ratio '${aspectRatio}'; allowed: ${allowed}`);
  }
  return size;
}

export function videoSizeFor(aspectRatio: string): string {
  const size = VIDEO_SIZES[aspectRatio];
  if (size === undefined) {
    const allowed = Object.keys(VIDEO_SIZES).join(", ");
    throw new Error(`unsupported video aspect_ratio '${aspectRatio}'; allowed: ${allowed}`);
  }
  return size;
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/ratios.test.ts`
Expected: PASS (6 assertions across 4 tests).

- [ ] **Step 11: Verify typecheck passes**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 12: Commit**

```bash
cd siliconflow
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/tool-def.ts src/ratios.ts tests/ratios.test.ts
git commit -m "feat: scaffold TS package + port ratios module"
```

---

### Task 2: `client` module — config + pure helpers

**Files:**
- Create: `siliconflow/src/client.ts` (helpers + `Settings` + `SiliconFlowError`; the client class is added in Task 3)
- Test: `siliconflow/tests/client.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1"`
  - `class SiliconFlowError extends Error`
  - `class Settings { readonly apiKey; readonly apiBase; readonly imageDir?; readonly audioDir?; static fromEnv(): Settings }`
  - `extractApiError(statusCode: number, body: string): string`
  - `extFromUrl(url: string, def?: string): string`
  - `buildFilename(prefix: string, ext: string, stamp: number): string`
  - `looksRemote(value: string): boolean`
  - `toImageField(value: string): string`

- [ ] **Step 1: Write the failing test `siliconflow/tests/client.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Settings,
  SiliconFlowError,
  buildFilename,
  extractApiError,
  extFromUrl,
  looksRemote,
  toImageField,
} from "../src/client";

const ENV_KEYS = [
  "SILICONFLOW_API_KEY",
  "SILICONFLOW_API_BASE",
  "SILICONFLOW_IMAGE_DIR",
  "SILICONFLOW_AUDIO_DIR",
];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("Settings.fromEnv", () => {
  it("uses defaults and trims the api key", () => {
    process.env.SILICONFLOW_API_KEY = "  sk-abc ";
    const s = Settings.fromEnv();
    expect(s.apiKey).toBe("sk-abc");
    expect(s.apiBase).toBe("https://api.siliconflow.cn/v1");
    expect(s.imageDir).toBeUndefined();
    expect(s.audioDir).toBeUndefined();
  });

  it("falls back audio dir to image dir and strips trailing slash from base", () => {
    process.env.SILICONFLOW_API_KEY = "k";
    process.env.SILICONFLOW_IMAGE_DIR = "/tmp/imgs";
    process.env.SILICONFLOW_API_BASE = "https://api.siliconflow.com/v1/";
    const s = Settings.fromEnv();
    expect(s.audioDir).toBe("/tmp/imgs");
    expect(s.apiBase).toBe("https://api.siliconflow.com/v1");
  });
});

describe("extractApiError", () => {
  it("pulls message from JSON body", () => {
    expect(extractApiError(400, '{"message": "invalid model"}')).toBe(
      "SiliconFlow API error 400: invalid model",
    );
  });
  it("falls back to plain text", () => {
    expect(extractApiError(500, "boom")).toBe("SiliconFlow API error 500: boom");
  });
});

describe("extFromUrl", () => {
  it("derives extension from url path", () => {
    expect(extFromUrl("https://x/y/a.mp4?sig=1")).toBe(".mp4");
    expect(extFromUrl("https://x/y/a.jpeg")).toBe(".jpeg");
    expect(extFromUrl("https://x/y/blob")).toBe(".png");
  });
});

describe("buildFilename", () => {
  it("builds deterministic names", () => {
    expect(buildFilename("image", ".png", 1700)).toBe("image_1700.png");
    expect(buildFilename("speech", "mp3", 42)).toBe("speech_42.mp3");
  });
});

describe("looksRemote", () => {
  it("detects http and data uris", () => {
    expect(looksRemote("https://x/a.png")).toBe(true);
    expect(looksRemote("data:image/png;base64,AAA")).toBe(true);
    expect(looksRemote("/home/u/a.png")).toBe(false);
  });
});

describe("toImageField", () => {
  it("passes through urls", () => {
    expect(toImageField("https://x/a.png")).toBe("https://x/a.png");
  });
  it("throws on missing file", () => {
    expect(() => toImageField("/no/such/file.png")).toThrow(SiliconFlowError);
  });
  it("base64-encodes a local file as a data uri", () => {
    const dir = mkdtempSync(join(tmpdir(), "sf-"));
    const f = join(dir, "pic.png");
    writeFileSync(f, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const out = toImageField(f);
    expect(out.startsWith("data:image/png;base64,")).toBe(true);
    expect(Buffer.from(out.split(",", 2)[1], "base64")).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/client.test.ts`
Expected: FAIL — cannot resolve `../src/client`.

- [ ] **Step 3: Create `siliconflow/src/client.ts` (helpers only — class comes in Task 3)**

```ts
/** Config, error handling, and pure asset helpers. (HTTP client is added in Task 3.) */

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname } from "node:path";

export const DEFAULT_API_BASE = "https://api.siliconflow.cn/v1";
export const REQUEST_TIMEOUT_MS = 300_000;

/** User-facing error from the SiliconFlow API or local IO. */
export class SiliconFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiliconFlowError";
  }
}

export class Settings {
  constructor(
    public readonly apiKey: string,
    public readonly apiBase: string,
    public readonly imageDir: string | undefined,
    public readonly audioDir: string | undefined,
  ) {}

  static fromEnv(): Settings {
    const imageDir = process.env.SILICONFLOW_IMAGE_DIR || undefined;
    const audioDir = process.env.SILICONFLOW_AUDIO_DIR || imageDir;
    const apiBase = (process.env.SILICONFLOW_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
    const apiKey = (process.env.SILICONFLOW_API_KEY || "").trim();
    return new Settings(apiKey, apiBase, imageDir, audioDir);
  }
}

/** Best-effort human-readable message from an error response body (pure). */
export function extractApiError(statusCode: number, body: string): string {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const err = (parsed as Record<string, any>).error;
      const errMsg = err && typeof err === "object" ? err.message : err;
      message = (parsed as Record<string, any>).message || errMsg || body;
    }
  } catch {
    // non-JSON body: keep raw text
  }
  return `SiliconFlow API error ${statusCode}: ${message}`;
}

/** Derive a file extension from a URL path (pure). */
export function extFromUrl(url: string, def = ".png"): string {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  for (const ext of [".png", ".jpg", ".jpeg", ".mp4", ".webp"]) {
    if (path.endsWith(ext)) return ext;
  }
  return def;
}

/** Deterministic asset filename (pure). */
export function buildFilename(prefix: string, ext: string, stamp: number): string {
  const dotExt = ext.startsWith(".") ? ext : `.${ext}`;
  return `${prefix}_${stamp}${dotExt}`;
}

/** True if value is an http(s) URL or a data URI (pure). */
export function looksRemote(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  );
}

/** Pass through a URL/data-URI; base64-encode a local file path. */
export function toImageField(value: string): string {
  if (looksRemote(value)) return value;
  if (!existsSync(value) || !statSync(value).isFile()) {
    throw new SiliconFlowError(`image file not found: ${value}`);
  }
  const data = readFileSync(value).toString("base64");
  const suffix = extname(value).replace(/^\./, "") || "png";
  return `data:image/${suffix};base64,${data}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/client.test.ts`
Expected: PASS (all `describe` blocks green).

- [ ] **Step 5: Verify typecheck passes**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/client.ts tests/client.test.ts
git commit -m "feat: port client config + pure helpers to TypeScript"
```

---

### Task 3: `client` module — HTTP client, asset rendering, singleton

**Files:**
- Modify: `siliconflow/src/client.ts` (append the client class, `renderAssets`, `getClient`)
- Test: `siliconflow/tests/render.test.ts`

**Interfaces:**
- Consumes: `Settings`, `SiliconFlowError`, `extractApiError`, `extFromUrl`, `buildFilename`, `REQUEST_TIMEOUT_MS` (Task 2).
- Produces:
  - `class SiliconFlowClient { readonly settings: Settings; requestJson(method, path, opts?): Promise<any>; requestBinary(method, path, opts?): Promise<Buffer>; download(url, saveDir, prefix): Promise<string>; saveBinary(content: Buffer, saveDir, ext, prefix): string }`
  - `renderAssets(client: SiliconFlowClient, kind: string, urls: string[], saveDir: string | undefined, prefix: string, header: string): Promise<string>`
  - `getClient(): SiliconFlowClient`

- [ ] **Step 1: Write the failing test `siliconflow/tests/render.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderAssets, SiliconFlowClient, Settings } from "../src/client";

function fakeClient(): SiliconFlowClient {
  return new SiliconFlowClient(new Settings("k", "https://api.siliconflow.cn/v1", undefined, undefined));
}

describe("renderAssets", () => {
  it("reports when no urls are returned", async () => {
    const out = await renderAssets(fakeClient(), "image", [], undefined, "image", "Header");
    expect(out).toBe("Header: no image returned by the API.");
  });

  it("lists remote urls with an expiry hint when no save dir", async () => {
    const out = await renderAssets(
      fakeClient(),
      "image",
      ["https://x/a.png", "https://x/b.png"],
      undefined,
      "image",
      "Generated 2 image(s)",
    );
    expect(out).toBe(
      "Generated 2 image(s):\n" +
        "  1. https://x/a.png  (remote URL, expires soon — set a save dir to keep it)\n" +
        "  2. https://x/b.png  (remote URL, expires soon — set a save dir to keep it)",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/render.test.ts`
Expected: FAIL — `renderAssets` / `SiliconFlowClient` not exported.

- [ ] **Step 3: Append the client class, `renderAssets`, and `getClient` to `siliconflow/src/client.ts`**

Add these imports to the existing import block at the top of the file (merge with the current `node:fs` import):

```ts
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
```

Append at the end of the file:

```ts
async function fetchWithTimeout(url: string | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface RequestOptions {
  json?: unknown;
  params?: Record<string, string>;
}

export class SiliconFlowClient {
  constructor(public readonly settings: Settings) {
    if (!settings.apiKey) {
      throw new SiliconFlowError("SILICONFLOW_API_KEY is not set");
    }
  }

  private get headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.settings.apiKey}` };
  }

  private buildUrl(path: string): string {
    return `${this.settings.apiBase}/${path.replace(/^\//, "")}`;
  }

  async requestJson(method: string, path: string, opts: RequestOptions = {}): Promise<any> {
    const url = new URL(this.buildUrl(path));
    if (opts.params) {
      for (const [k, v] of Object.entries(opts.params)) {
        if (v != null) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = { ...this.headers };
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const resp = await fetchWithTimeout(url, { method, headers, body });
    const text = await resp.text();
    if (resp.status >= 400) {
      throw new SiliconFlowError(extractApiError(resp.status, text));
    }
    return JSON.parse(text);
  }

  async requestBinary(method: string, path: string, opts: RequestOptions = {}): Promise<Buffer> {
    const headers: Record<string, string> = { ...this.headers };
    let body: string | undefined;
    if (opts.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const resp = await fetchWithTimeout(this.buildUrl(path), { method, headers, body });
    if (resp.status >= 400) {
      const text = await resp.text();
      throw new SiliconFlowError(extractApiError(resp.status, text));
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  /** Download asset to saveDir; on any failure return the original URL. */
  async download(url: string, saveDir: string, prefix: string): Promise<string> {
    try {
      mkdirSync(saveDir, { recursive: true });
      const resp = await fetchWithTimeout(url, { method: "GET" });
      if (!resp.ok) throw new SiliconFlowError(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      const name = buildFilename(prefix, extFromUrl(url), Math.floor(Date.now() / 1000));
      const filePath = resolve(join(saveDir, name));
      writeFileSync(filePath, buf);
      return filePath;
    } catch {
      return url;
    }
  }

  saveBinary(content: Buffer, saveDir: string, ext: string, prefix: string): string {
    mkdirSync(saveDir, { recursive: true });
    const name = buildFilename(prefix, ext, Math.floor(Date.now() / 1000));
    const filePath = resolve(join(saveDir, name));
    writeFileSync(filePath, content);
    return filePath;
  }
}

let _client: SiliconFlowClient | undefined;

/** Lazy singleton built from env (avoids import-time env reads). */
export function getClient(): SiliconFlowClient {
  if (!_client) _client = new SiliconFlowClient(Settings.fromEnv());
  return _client;
}

/** Download each url (if saveDir set) and format an LLM-readable summary. */
export async function renderAssets(
  client: SiliconFlowClient,
  kind: string,
  urls: string[],
  saveDir: string | undefined,
  prefix: string,
  header: string,
): Promise<string> {
  if (urls.length === 0) {
    return `${header}: no ${kind} returned by the API.`;
  }
  const lines = [`${header}:`];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (saveDir) {
      const local = await client.download(url, saveDir, prefix);
      lines.push(`  ${i + 1}. ${local}  (source: ${url})`);
    } else {
      lines.push(`  ${i + 1}. ${url}  (remote URL, expires soon — set a save dir to keep it)`);
    }
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/render.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the whole suite + typecheck**

Run: `cd siliconflow && npm test && npm run typecheck`
Expected: all tests pass; typecheck exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/client.ts tests/render.test.ts
git commit -m "feat: port HTTP client, asset rendering, and singleton"
```

---

### Task 4: `images` module + tools

**Files:**
- Create: `siliconflow/src/images.ts`
- Test: `siliconflow/tests/images.test.ts`

**Interfaces:**
- Consumes: `getClient`, `renderAssets`, `toImageField` (client), `imageSizeFor` (ratios), `ToolDef` (tool-def).
- Produces:
  - `interface ImagePayloadOpts { prompt; model; imageSize?; negativePrompt?; batchSize?; seed?; numInferenceSteps?; guidanceScale?; cfg?; images?: Record<string,string> }`
  - `buildImagePayload(o: ImagePayloadOpts): Record<string, unknown>`
  - `parseImageResponse(data: any): [string[], number | undefined]`
  - `imageTools: ToolDef[]` (`generate_image`, `edit_image`)

- [ ] **Step 1: Write the failing test `siliconflow/tests/images.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildImagePayload, parseImageResponse, imageTools } from "../src/images";

describe("buildImagePayload", () => {
  it("includes only set optional fields", () => {
    const p = buildImagePayload({ prompt: "a cat", model: "M", imageSize: "1024x1024" });
    expect(p).toEqual({
      model: "M",
      prompt: "a cat",
      batch_size: 1,
      num_inference_steps: 20,
      image_size: "1024x1024",
    });
  });

  it("adds negative_prompt, seed, guidance_scale, cfg, and image fields when present", () => {
    const p = buildImagePayload({
      prompt: "a dog",
      model: "M",
      negativePrompt: "blurry",
      seed: 7,
      guidanceScale: 3.5,
      cfg: 1.2,
      images: { image: "data:...", image2: "" },
    });
    expect(p.negative_prompt).toBe("blurry");
    expect(p.seed).toBe(7);
    expect(p.guidance_scale).toBe(3.5);
    expect(p.cfg).toBe(1.2);
    expect(p.image).toBe("data:...");
    expect("image2" in p).toBe(false); // falsy image value is skipped
  });
});

describe("parseImageResponse", () => {
  it("extracts urls and seed", () => {
    const [urls, seed] = parseImageResponse({
      images: [{ url: "https://x/a.png" }, { nope: 1 }, { url: "https://x/b.png" }],
      seed: 99,
    });
    expect(urls).toEqual(["https://x/a.png", "https://x/b.png"]);
    expect(seed).toBe(99);
  });
});

describe("imageTools", () => {
  it("registers generate_image and edit_image", () => {
    expect(imageTools.map((t) => t.name).sort()).toEqual(["edit_image", "generate_image"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/images.test.ts`
Expected: FAIL — cannot resolve `../src/images`.

- [ ] **Step 3: Create `siliconflow/src/images.ts`**

```ts
/** Image generation and editing tools (POST /v1/images/generations). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient, renderAssets, toImageField } from "./client.js";
import { imageSizeFor } from "./ratios.js";

export interface ImagePayloadOpts {
  prompt: string;
  model: string;
  imageSize?: string;
  negativePrompt?: string;
  batchSize?: number;
  seed?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  cfg?: number;
  images?: Record<string, string>;
}

export function buildImagePayload(o: ImagePayloadOpts): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: o.model,
    prompt: o.prompt,
    batch_size: o.batchSize ?? 1,
    num_inference_steps: o.numInferenceSteps ?? 20,
  };
  if (o.imageSize) payload.image_size = o.imageSize;
  if (o.negativePrompt) payload.negative_prompt = o.negativePrompt;
  if (o.seed !== undefined) payload.seed = o.seed;
  if (o.guidanceScale !== undefined) payload.guidance_scale = o.guidanceScale;
  if (o.cfg !== undefined) payload.cfg = o.cfg;
  for (const [key, value] of Object.entries(o.images ?? {})) {
    if (value) payload[key] = value;
  }
  return payload;
}

export function parseImageResponse(data: any): [string[], number | undefined] {
  const urls: string[] = (data.images ?? [])
    .filter((img: any) => img?.url)
    .map((img: any) => img.url as string);
  return [urls, data.seed];
}

async function generateImage(args: Record<string, any>) {
  const client = getClient();
  const payload = buildImagePayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: imageSizeFor(args.aspect_ratio),
    negativePrompt: args.negative_prompt,
    batchSize: args.batch_size,
    seed: args.seed,
    numInferenceSteps: args.num_inference_steps,
    guidanceScale: args.guidance_scale,
    cfg: args.cfg,
  });
  const data = await client.requestJson("POST", "/images/generations", { json: payload });
  const [urls, outSeed] = parseImageResponse(data);
  const header = `Generated ${urls.length} image(s) with ${args.model} (seed=${outSeed})`;
  const text = await renderAssets(client, "image", urls, client.settings.imageDir, "image", header);
  return { content: [{ type: "text" as const, text }] };
}

async function editImage(args: Record<string, any>) {
  const client = getClient();
  const images: Record<string, string> = { image: toImageField(args.image) };
  if (args.image2) images.image2 = toImageField(args.image2);
  if (args.image3) images.image3 = toImageField(args.image3);
  const payload = buildImagePayload({
    prompt: args.prompt,
    model: args.model,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
    images,
  });
  const data = await client.requestJson("POST", "/images/generations", { json: payload });
  const [urls, outSeed] = parseImageResponse(data);
  const header = `Edited image with ${args.model} (seed=${outSeed})`;
  const text = await renderAssets(client, "image", urls, client.settings.imageDir, "edit", header);
  return { content: [{ type: "text" as const, text }] };
}

export const imageTools: ToolDef[] = [
  {
    name: "generate_image",
    description: "Generate image(s) from a text prompt via SiliconFlow. Returns local paths and URLs.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Kwai-Kolors/Kolors"),
      aspect_ratio: z.string().default("1:1"),
      negative_prompt: z.string().optional(),
      batch_size: z.number().int().default(1),
      seed: z.number().int().optional(),
      num_inference_steps: z.number().int().default(20),
      guidance_scale: z.number().optional(),
      cfg: z.number().optional(),
    },
    handler: generateImage,
  },
  {
    name: "edit_image",
    description: "Edit / transform an image (local path or URL) with a text instruction.",
    inputSchema: {
      prompt: z.string(),
      image: z.string(),
      model: z.string().default("Qwen/Qwen-Image-Edit-2509"),
      image2: z.string().optional(),
      image3: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
    },
    handler: editImage,
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/images.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/images.ts tests/images.test.ts
git commit -m "feat: port image generation + editing tools"
```

---

### Task 5: `videos` module + tools

**Files:**
- Create: `siliconflow/src/videos.ts`
- Test: `siliconflow/tests/videos.test.ts`

**Interfaces:**
- Consumes: `getClient`, `renderAssets`, `toImageField`, `SiliconFlowError` (client), `videoSizeFor` (ratios), `ToolDef`.
- Produces:
  - `interface VideoPayloadOpts { prompt; model; imageSize; image?; negativePrompt?; seed? }`
  - `buildVideoPayload(o: VideoPayloadOpts): Record<string, unknown>`
  - `parseSubmitResponse(data: any): string`
  - `parseStatusResponse(data: any): { status: string; reason?: string; urls: string[] }`
  - `videoTools: ToolDef[]` (`generate_video`, `submit_video_generation`, `get_video_status`)

- [ ] **Step 1: Write the failing test `siliconflow/tests/videos.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  buildVideoPayload,
  parseSubmitResponse,
  parseStatusResponse,
  videoTools,
} from "../src/videos";
import { SiliconFlowError } from "../src/client";

describe("buildVideoPayload", () => {
  it("includes only set optional fields", () => {
    expect(buildVideoPayload({ prompt: "p", model: "M", imageSize: "1280x720" })).toEqual({
      model: "M",
      prompt: "p",
      image_size: "1280x720",
    });
  });
  it("adds image, negative_prompt, seed when present", () => {
    const p = buildVideoPayload({
      prompt: "p",
      model: "M",
      imageSize: "1280x720",
      image: "data:...",
      negativePrompt: "no",
      seed: 5,
    });
    expect(p.image).toBe("data:...");
    expect(p.negative_prompt).toBe("no");
    expect(p.seed).toBe(5);
  });
});

describe("parseSubmitResponse", () => {
  it("returns requestId", () => {
    expect(parseSubmitResponse({ requestId: "abc" })).toBe("abc");
  });
  it("throws when requestId missing", () => {
    expect(() => parseSubmitResponse({})).toThrow(SiliconFlowError);
  });
});

describe("parseStatusResponse", () => {
  it("normalizes status, reason, and urls", () => {
    expect(
      parseStatusResponse({
        status: "Succeed",
        results: { videos: [{ url: "https://x/v.mp4" }, { nope: 1 }] },
      }),
    ).toEqual({ status: "Succeed", reason: undefined, urls: ["https://x/v.mp4"] });
  });
  it("defaults status to Unknown", () => {
    expect(parseStatusResponse({})).toEqual({ status: "Unknown", reason: undefined, urls: [] });
  });
});

describe("videoTools", () => {
  it("registers the three video tools", () => {
    expect(videoTools.map((t) => t.name).sort()).toEqual([
      "generate_video",
      "get_video_status",
      "submit_video_generation",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/videos.test.ts`
Expected: FAIL — cannot resolve `../src/videos`.

- [ ] **Step 3: Create `siliconflow/src/videos.ts`**

```ts
/** Video generation tools (POST /v1/video/submit + /v1/video/status). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient, renderAssets, toImageField, SiliconFlowError } from "./client.js";
import { videoSizeFor } from "./ratios.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface VideoPayloadOpts {
  prompt: string;
  model: string;
  imageSize: string;
  image?: string;
  negativePrompt?: string;
  seed?: number;
}

export function buildVideoPayload(o: VideoPayloadOpts): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: o.model,
    prompt: o.prompt,
    image_size: o.imageSize,
  };
  if (o.image) payload.image = o.image;
  if (o.negativePrompt) payload.negative_prompt = o.negativePrompt;
  if (o.seed !== undefined) payload.seed = o.seed;
  return payload;
}

export function parseSubmitResponse(data: any): string {
  const requestId = data.requestId;
  if (!requestId) {
    throw new SiliconFlowError(`unexpected video submit response: ${JSON.stringify(data)}`);
  }
  return requestId;
}

export function parseStatusResponse(data: any): { status: string; reason?: string; urls: string[] } {
  const results = data.results ?? {};
  return {
    status: data.status ?? "Unknown",
    reason: data.reason,
    urls: (results.videos ?? []).filter((v: any) => v?.url).map((v: any) => v.url as string),
  };
}

async function submitVideoGeneration(args: Record<string, any>) {
  const client = getClient();
  const payload = buildVideoPayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: videoSizeFor(args.aspect_ratio),
    image: args.image ? toImageField(args.image) : undefined,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
  });
  const data = await client.requestJson("POST", "/video/submit", { json: payload });
  const requestId = parseSubmitResponse(data);
  return {
    content: [
      { type: "text" as const, text: `Video job submitted. requestId: ${requestId}\nPoll with get_video_status.` },
    ],
  };
}

async function getVideoStatus(args: Record<string, any>) {
  const client = getClient();
  const data = await client.requestJson("POST", "/video/status", {
    json: { requestId: args.request_id },
  });
  const status = parseStatusResponse(data);
  if (status.status === "Succeed") {
    const text = await renderAssets(
      client,
      "video",
      status.urls,
      client.settings.imageDir,
      "video",
      `Video ready (requestId ${args.request_id})`,
    );
    return { content: [{ type: "text" as const, text }] };
  }
  if (status.status === "Failed") {
    return {
      content: [
        { type: "text" as const, text: `Video generation failed: ${status.reason || "unknown reason"}` },
      ],
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Video status: ${status.status} (still processing). Poll again with requestId ${args.request_id}.`,
      },
    ],
  };
}

async function generateVideo(args: Record<string, any>) {
  const client = getClient();
  const payload = buildVideoPayload({
    prompt: args.prompt,
    model: args.model,
    imageSize: videoSizeFor(args.aspect_ratio),
    image: args.image ? toImageField(args.image) : undefined,
    negativePrompt: args.negative_prompt,
    seed: args.seed,
  });
  const submit = await client.requestJson("POST", "/video/submit", { json: payload });
  const requestId = parseSubmitResponse(submit);
  const maxWait: number = args.max_wait_seconds;
  const pollInterval: number = args.poll_interval_seconds;
  let waited = 0;
  while (waited < maxWait) {
    await sleep(pollInterval * 1000);
    waited += pollInterval;
    const data = await client.requestJson("POST", "/video/status", { json: { requestId } });
    const status = parseStatusResponse(data);
    if (status.status === "Succeed") {
      const text = await renderAssets(
        client,
        "video",
        status.urls,
        client.settings.imageDir,
        "video",
        `Generated video with ${args.model}`,
      );
      return { content: [{ type: "text" as const, text }] };
    }
    if (status.status === "Failed") {
      return {
        content: [
          { type: "text" as const, text: `Video generation failed: ${status.reason || "unknown reason"}` },
        ],
      };
    }
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Video still processing after ${maxWait}s. Poll later with get_video_status, requestId: ${requestId}.`,
      },
    ],
  };
}

export const videoTools: ToolDef[] = [
  {
    name: "generate_video",
    description: "Generate a video and poll until done (with a timeout). Returns the saved path / URL.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Wan-AI/Wan2.2-T2V-A14B"),
      aspect_ratio: z.string().default("16:9"),
      image: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
      max_wait_seconds: z.number().int().default(600),
      poll_interval_seconds: z.number().int().default(5),
    },
    handler: generateVideo,
  },
  {
    name: "submit_video_generation",
    description: "Submit a video generation job; returns a requestId to poll with get_video_status.",
    inputSchema: {
      prompt: z.string(),
      model: z.string().default("Wan-AI/Wan2.2-T2V-A14B"),
      aspect_ratio: z.string().default("16:9"),
      image: z.string().optional(),
      negative_prompt: z.string().optional(),
      seed: z.number().int().optional(),
    },
    handler: submitVideoGeneration,
  },
  {
    name: "get_video_status",
    description: "Check a video job's status; on success returns the saved path / URL.",
    inputSchema: {
      request_id: z.string(),
    },
    handler: getVideoStatus,
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/videos.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/videos.ts tests/videos.test.ts
git commit -m "feat: port video submit/status/generate tools"
```

---

### Task 6: `audio` module + tool

**Files:**
- Create: `siliconflow/src/audio.ts`
- Test: `siliconflow/tests/audio.test.ts`

**Interfaces:**
- Consumes: `getClient` (client), `ToolDef`.
- Produces:
  - `interface SpeechPayloadOpts { input; model; voice?; responseFormat?; speed?; gain? }`
  - `buildSpeechPayload(o: SpeechPayloadOpts): Record<string, unknown>`
  - `extForFormat(responseFormat: string): string`
  - `audioTools: ToolDef[]` (`generate_speech`)

- [ ] **Step 1: Write the failing test `siliconflow/tests/audio.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildSpeechPayload, extForFormat, audioTools } from "../src/audio";

describe("buildSpeechPayload", () => {
  it("builds a non-streaming payload and omits voice when unset", () => {
    expect(buildSpeechPayload({ input: "hi", model: "M" })).toEqual({
      model: "M",
      input: "hi",
      response_format: "mp3",
      speed: 1.0,
      gain: 0.0,
      stream: false,
    });
  });
  it("includes voice when set", () => {
    const p = buildSpeechPayload({ input: "hi", model: "M", voice: "M:alex" });
    expect(p.voice).toBe("M:alex");
  });
});

describe("extForFormat", () => {
  it("passes known formats through and falls back to mp3", () => {
    expect(extForFormat("wav")).toBe("wav");
    expect(extForFormat("opus")).toBe("opus");
    expect(extForFormat("flac")).toBe("mp3");
  });
});

describe("audioTools", () => {
  it("registers generate_speech", () => {
    expect(audioTools.map((t) => t.name)).toEqual(["generate_speech"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/audio.test.ts`
Expected: FAIL — cannot resolve `../src/audio`.

- [ ] **Step 3: Create `siliconflow/src/audio.ts`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/audio.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/audio.ts tests/audio.test.ts
git commit -m "feat: port text-to-speech tool"
```

---

### Task 7: `user` module + tools

**Files:**
- Create: `siliconflow/src/user.ts`
- Test: `siliconflow/tests/user.test.ts`

**Interfaces:**
- Consumes: `getClient` (client), `ToolDef`.
- Produces:
  - `parseUserInfo(data: any): { name; email; total_balance; charge_balance; gift_balance }`
  - `parseModelList(data: any): string[]`
  - `userTools: ToolDef[]` (`get_user_info`, `list_models`)

- [ ] **Step 1: Write the failing test `siliconflow/tests/user.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseUserInfo, parseModelList, userTools } from "../src/user";

describe("parseUserInfo", () => {
  it("maps nested data fields", () => {
    expect(
      parseUserInfo({
        data: {
          name: "Ann",
          email: "a@x.com",
          totalBalance: "10",
          chargeBalance: "7",
          balance: "3",
        },
      }),
    ).toEqual({
      name: "Ann",
      email: "a@x.com",
      total_balance: "10",
      charge_balance: "7",
      gift_balance: "3",
    });
  });
  it("falls back to the top-level object when data is absent", () => {
    expect(parseUserInfo({ name: "Bo" }).name).toBe("Bo");
  });
});

describe("parseModelList", () => {
  it("extracts ids and skips entries without an id", () => {
    expect(parseModelList({ data: [{ id: "a" }, { x: 1 }, { id: "b" }] })).toEqual(["a", "b"]);
  });
});

describe("userTools", () => {
  it("registers get_user_info and list_models", () => {
    expect(userTools.map((t) => t.name).sort()).toEqual(["get_user_info", "list_models"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/user.test.ts`
Expected: FAIL — cannot resolve `../src/user`.

- [ ] **Step 3: Create `siliconflow/src/user.ts`**

```ts
/** Account + model-discovery tools (GET /v1/user/info, GET /v1/models). */

import { z } from "zod";
import type { ToolDef } from "./tool-def.js";
import { getClient } from "./client.js";

export function parseUserInfo(data: any): {
  name: any;
  email: any;
  total_balance: any;
  charge_balance: any;
  gift_balance: any;
} {
  const d = data.data ?? data;
  return {
    name: d.name,
    email: d.email,
    total_balance: d.totalBalance,
    charge_balance: d.chargeBalance,
    gift_balance: d.balance,
  };
}

export function parseModelList(data: any): string[] {
  return (data.data ?? []).filter((m: any) => m?.id).map((m: any) => m.id as string);
}

async function getUserInfo(_args: Record<string, any>) {
  const client = getClient();
  const data = await client.requestJson("GET", "/user/info");
  const info = parseUserInfo(data);
  const text =
    "SiliconFlow account:\n" +
    `  name: ${info.name}\n` +
    `  email: ${info.email}\n` +
    `  total balance: ${info.total_balance}\n` +
    `  charged: ${info.charge_balance}  gift: ${info.gift_balance}`;
  return { content: [{ type: "text" as const, text }] };
}

async function listModels(args: Record<string, any>) {
  const client = getClient();
  const params: Record<string, string> = {};
  if (args.type) params.type = args.type;
  if (args.sub_type) params.sub_type = args.sub_type;
  const data = await client.requestJson("GET", "/models", {
    params: Object.keys(params).length ? params : undefined,
  });
  const models = parseModelList(data);
  if (models.length === 0) {
    return { content: [{ type: "text" as const, text: "No models found." }] };
  }
  const text = "Available models:\n" + models.map((m) => `  - ${m}`).join("\n");
  return { content: [{ type: "text" as const, text }] };
}

export const userTools: ToolDef[] = [
  {
    name: "get_user_info",
    description: "Show the SiliconFlow account profile and balances (total / charged / gift).",
    inputSchema: {},
    handler: getUserInfo,
  },
  {
    name: "list_models",
    description:
      "List available models. type: text|image|audio|video; sub_type: e.g. text-to-image, image-to-image, text-to-video, speech-to-text.",
    inputSchema: {
      type: z.string().optional(),
      sub_type: z.string().optional(),
    },
    handler: listModels,
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/user.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify typecheck**

Run: `cd siliconflow && npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd siliconflow
git add src/user.ts tests/user.test.ts
git commit -m "feat: port get_user_info and list_models tools"
```

---

### Task 8: `index` entry point + server wiring

**Files:**
- Create: `siliconflow/src/index.ts`
- Test: `siliconflow/tests/registration.test.ts`

**Interfaces:**
- Consumes: `imageTools`, `videoTools`, `audioTools`, `userTools`, `ToolDef`.
- Produces:
  - `allTools: ToolDef[]` (the 8 combined tools)
  - `buildServer(): McpServer`
  - `main(): Promise<void>` (guarded — runs only when invoked as the CLI entry)

> **SDK API note for the implementer:** This task is the only place that calls the MCP SDK registration API. The intended call is `server.registerTool(name, { description, inputSchema }, handler)` from `@modelcontextprotocol/sdk@^1.29`. If `registerTool`'s exact config keys differ in the installed version, check `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts` and adjust the single `registerTool` call below (the `ToolDef` array and the registration test do not depend on the SDK). A fallback older signature is `server.tool(name, description, inputSchema, handler)`.

- [ ] **Step 1: Write the failing test `siliconflow/tests/registration.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { allTools } from "../src/index";

describe("allTools", () => {
  it("aggregates exactly the 8 expected tools with unique names", () => {
    const names = allTools.map((t) => t.name).sort();
    expect(names).toEqual([
      "edit_image",
      "generate_image",
      "generate_speech",
      "generate_video",
      "get_user_info",
      "get_video_status",
      "list_models",
      "submit_video_generation",
    ]);
    expect(new Set(names).size).toBe(8);
  });

  it("every tool has a non-empty description and an input schema object", () => {
    for (const t of allTools) {
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.inputSchema).toBe("object");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd siliconflow && npx vitest run tests/registration.test.ts`
Expected: FAIL — cannot resolve `../src/index`.

- [ ] **Step 3: Create `siliconflow/src/index.ts`**

```ts
#!/usr/bin/env node
/** Entry point: build the MCP server, register all SiliconFlow media tools, serve over stdio. */

import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ToolDef } from "./tool-def.js";
import { imageTools } from "./images.js";
import { videoTools } from "./videos.js";
import { audioTools } from "./audio.js";
import { userTools } from "./user.js";

export const allTools: ToolDef[] = [...imageTools, ...videoTools, ...audioTools, ...userTools];

export function buildServer(): McpServer {
  const server = new McpServer({ name: "aleph-siliconflow-mcp", version: "0.2.0" });
  for (const tool of allTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.handler,
    );
  }
  return server;
}

export async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isEntry = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd siliconflow && npx vitest run tests/registration.test.ts`
Expected: PASS (2 tests). Importing `index` must NOT connect stdio (guarded by `isEntry`).

- [ ] **Step 5: Build and smoke-test the compiled entry point**

Run: `cd siliconflow && npm run build && node dist/index.js < /dev/null`
Expected: process starts and exits cleanly when stdin closes (no stack trace). `dist/index.js` exists with the `#!/usr/bin/env node` shebang as its first line.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `cd siliconflow && npm test && npm run typecheck`
Expected: all tests pass (ratios, client, render, images, videos, audio, user, registration); typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
cd siliconflow
git add src/index.ts tests/registration.test.ts
git commit -m "feat: wire MCP server entry point + stdio transport"
```

---

### Task 9: CI + npm publish workflows

**Files:**
- Modify: `.github/workflows/ci.yml` (replace contents — repo root, not `siliconflow/`)
- Modify: `.github/workflows/publish.yml` (replace contents)

**Interfaces:**
- Consumes: `siliconflow/package.json` scripts (`typecheck`, `test`, `build`), `siliconflow/package-lock.json`.
- Produces: green CI on push/PR; npm publish on GitHub Release.

- [ ] **Step 1: Replace `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: siliconflow
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: siliconflow/package-lock.json
      - run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Test (vitest)
        run: npm test
```

- [ ] **Step 2: Replace `.github/workflows/publish.yml`**

```yaml
name: Publish to npm

# Publishes aleph-siliconflow-mcp to npm when a GitHub Release is published.
# Generates build provenance (--provenance) via GitHub OIDC.
#
# Auth: set an NPM_TOKEN repo secret (an npm automation token with publish rights).
# Alternatively, configure npm Trusted Publishing (OIDC) for the package on npmjs.com
# and remove the NODE_AUTH_TOKEN env below.

on:
  release:
    types: [published]

jobs:
  npm:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # required for --provenance
    defaults:
      run:
        working-directory: siliconflow
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Validate the workflow YAML parses**

Run: `python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]; print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/publish.yml
git commit -m "ci: switch CI + publish workflows from PyPI/uv to npm"
```

---

### Task 10: READMEs + remove Python artifacts + gitignore

**Files:**
- Modify: `README.md` (repo root)
- Modify: `siliconflow/README.md`
- Modify: `.gitignore` (repo root)
- Delete (tracked): `siliconflow/pyproject.toml`, `siliconflow/src/aleph_siliconflow_mcp/*.py` (8 files), `siliconflow/tests/test_*.py` (7 files)
- Delete (local): `siliconflow/dist/` (stale Python wheels), `siliconflow/.venv`, `siliconflow/.ruff_cache`, `siliconflow/.pytest_cache`

**Interfaces:**
- Consumes: nothing.
- Produces: a repo with no Python artifacts and Node/npx-only docs.

- [ ] **Step 1: Remove tracked Python source, tests, and packaging**

```bash
cd /Volumes/TBU4/Workspace/Aleph-mcp
git rm siliconflow/pyproject.toml
git rm siliconflow/src/aleph_siliconflow_mcp/__init__.py \
       siliconflow/src/aleph_siliconflow_mcp/main.py \
       siliconflow/src/aleph_siliconflow_mcp/server.py \
       siliconflow/src/aleph_siliconflow_mcp/client.py \
       siliconflow/src/aleph_siliconflow_mcp/ratios.py \
       siliconflow/src/aleph_siliconflow_mcp/images.py \
       siliconflow/src/aleph_siliconflow_mcp/videos.py \
       siliconflow/src/aleph_siliconflow_mcp/audio.py \
       siliconflow/src/aleph_siliconflow_mcp/user.py
git rm siliconflow/tests/test_audio.py \
       siliconflow/tests/test_client.py \
       siliconflow/tests/test_images.py \
       siliconflow/tests/test_ratios.py \
       siliconflow/tests/test_server.py \
       siliconflow/tests/test_user.py \
       siliconflow/tests/test_videos.py
```

Expected: the listed files are staged for deletion. The `src/aleph_siliconflow_mcp/` directory becomes empty (its only contents were these `.py` files plus untracked `__pycache__`).

- [ ] **Step 2: Remove stale local-only Python artifacts (untracked / gitignored)**

```bash
cd /Volumes/TBU4/Workspace/Aleph-mcp
rm -rf siliconflow/dist siliconflow/.venv siliconflow/.ruff_cache siliconflow/.pytest_cache \
       siliconflow/src/aleph_siliconflow_mcp
```

Expected: directories removed locally (they were git-ignored or already untracked; `node` build writes a fresh `siliconflow/dist/`).

- [ ] **Step 3: Replace the repo-root `.gitignore`**

```
node_modules/
dist/
build/
*.log
.env
```

- [ ] **Step 4: Replace `siliconflow/README.md`**

````markdown
# SiliconFlow MCP (aleph-siliconflow-mcp)

Aleph's official SiliconFlow media-generation MCP server: **image / video / TTS**.
Aleph 官方的硅基流动多媒体生成 MCP 服务（图片 / 视频 / 语音合成）。

SiliconFlow ships no official MCP, so Aleph builds one. Text chat / embedding / rerank
are already handled by Aleph core, so this server is **media-only**.

---

## Prerequisites / 前置要求

1. **[Node.js](https://nodejs.org/) 18 or newer** (provides `npx`):
   ```bash
   node --version   # must be >= 18
   ```
   `npx` downloads and launches the server on demand — no manual install needed.
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
  -- npx -y aleph-siliconflow-mcp@0.2.0
```

### Option C — Claude Desktop / any MCP client (JSON) / 通用 JSON 配置

Add this to your client's MCP config
(Claude Desktop: `claude_desktop_config.json`; others: their `mcpServers` block):

```json
{
  "mcpServers": {
    "siliconflow": {
      "command": "npx",
      "args": ["-y", "aleph-siliconflow-mcp@0.2.0"],
      "env": {
        "SILICONFLOW_API_KEY": "your_api_key_here",
        "SILICONFLOW_IMAGE_DIR": "/path/to/save"
      }
    }
  }
}
```

> **Pinned vs latest / 固定版本与最新版**: `aleph-siliconflow-mcp@0.2.0` pins a reproducible
> release from [npm](https://www.npmjs.com/package/aleph-siliconflow-mcp) (recommended); use
> `aleph-siliconflow-mcp` (no `@version`) to always get the latest. The first launch downloads
> and caches the package (a few seconds).

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
npm ci            # install dependencies
npm test          # run the vitest suite
npm run typecheck # tsc --noEmit
npm run build     # compile src/ → dist/
```

> **Note:** this package was previously published on PyPI (`uvx aleph-siliconflow-mcp`, v0.1.0).
> It has been rewritten in TypeScript and now ships on npm; the PyPI release is deprecated.

License: MIT.
````

- [ ] **Step 5: Replace the repo-root `README.md`**

````markdown
# Aleph-mcp

Official MCP servers built and maintained by the Aleph project.

## Charter

Aleph-mcp fills official gaps. Where a vendor ships no official MCP server, Aleph builds one here. Where an official MCP already exists (e.g. Volcengine veImageX), Aleph's preset catalog points at the upstream source instead of duplicating it.

## Servers

| Directory | Description | Runtime |
|-----------|-------------|---------|
| `siliconflow/` | SiliconFlow media generation — image / video / TTS | Node.js ≥ 18 (`npx aleph-siliconflow-mcp`) |

## Credits

API knowledge for the SiliconFlow server was referenced from the community project [`stevefordev/siliconflow-mcp`](https://github.com/stevefordev/siliconflow-mcp) (MIT). All endpoints were verified against the official SiliconFlow documentation at <https://api-docs.siliconflow.cn>. This server is a clean rewrite.

## License

MIT — see [LICENSE](LICENSE).
````

- [ ] **Step 6: Verify no Python artifacts remain and the suite still passes**

Run:
```bash
cd /Volumes/TBU4/Workspace/Aleph-mcp
git ls-files '*.py' ; echo "py-tracked-above (should be empty)"
cd siliconflow && npm test
```
Expected: no `.py` files tracked; vitest suite green.

- [ ] **Step 7: Commit**

```bash
cd /Volumes/TBU4/Workspace/Aleph-mcp
git add -A
git commit -m "chore: remove Python implementation; document Node/npx workflow"
```

---

### Task 11: Repoint the Aleph catalog (main repo)

> **Different repository.** This task edits the **Aleph main repo** at
> `/Volumes/TBU4/Workspace/Aleph`, not `Aleph-mcp`. It makes the preset install use the
> new npm package. The Rust `node` runtime probe already exists, so no code changes are
> needed — only `catalog.json`.

**Files:**
- Modify: `/Volumes/TBU4/Workspace/Aleph/src/mcp/presets/catalog.json` (the `siliconflow` entry's single `transports` object)

**Interfaces:**
- Consumes: published `aleph-siliconflow-mcp@0.2.0` on npm (Task 9 publishes it on Release; for local testing, `npx` resolves it once published).
- Produces: a catalog whose `siliconflow` preset launches via `npx … requires_runtime: node`.

- [ ] **Step 1: Edit the `siliconflow` transport in `catalog.json`**

In `/Volumes/TBU4/Workspace/Aleph/src/mcp/presets/catalog.json`, locate the `siliconflow`
entry's `transports` array (currently a single object) and replace that object:

Replace:
```json
{
  "kind": "stdio",
  "command": "uvx",
  "args": [
    "aleph-siliconflow-mcp@0.1.0"
  ],
  "requires_runtime": "python"
}
```
With:
```json
{
  "kind": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "aleph-siliconflow-mcp@0.2.0"
  ],
  "requires_runtime": "node"
}
```

Leave the rest of the `siliconflow` entry (`id`, `name`, `category`, `description`,
`vendor`, `official`, `reachability`, `required_env`, `tags`) unchanged.

- [ ] **Step 2: Verify the JSON still parses and the transport changed**

Run:
```bash
cd /Volumes/TBU4/Workspace/Aleph
python3 -c "import json; d=json.load(open('src/mcp/presets/catalog.json')); e=[x for x in d if x['id']=='siliconflow'][0]['transports'][0]; assert e['command']=='npx' and e['requires_runtime']=='node' and e['args']==['-y','aleph-siliconflow-mcp@0.2.0'], e; print('ok:', e)"
```
Expected: `ok: {...npx...}`.

- [ ] **Step 3: Commit (in the main Aleph repo)**

```bash
cd /Volumes/TBU4/Workspace/Aleph
git add src/mcp/presets/catalog.json
git commit -m "mcp: repoint siliconflow preset to npx (TS rewrite)"
```

---

## Post-implementation manual steps (not automated by this plan)

These require credentials/UI access and are listed for the operator to do after merge:

1. **Tag + Release for npm publish:** create git tag `v0.2.0` on `Aleph-mcp` and publish a
   GitHub Release from it → triggers `publish.yml`. Ensure the `NPM_TOKEN` secret exists
   (or npm Trusted Publishing is configured for the package).
2. **End-to-end check** once published: `npx -y aleph-siliconflow-mcp@0.2.0` should start and
   respond to a `tools/list` request with the 8 tools; installing the `siliconflow` preset in
   Aleph should connect via the `node` runtime.
3. **Yank the PyPI release:** mark `aleph-siliconflow-mcp 0.1.0` as *yanked* on PyPI
   (project page → Manage → Releases → Yank). The READMEs already point users to npm.

---

## Self-Review

**1. Spec coverage:**
- §1 goal / full replace → Tasks 1–8 (rewrite) + Task 10 (delete Python). ✅
- §2 module map (index, client, ratios, images, videos, audio, user) → Tasks 1–8 one-to-one. ✅
- §2 tool-wiring pattern (`ToolDef[]` per module, `index.ts` registers) → `tool-def.ts` (Task 1), per-module arrays (Tasks 4–7), `index.ts` (Task 8). ✅
- §3 tool-contract parity (8 tools, params/defaults/types, no enums, no param descriptions, ported output strings) → Tasks 4–7 inputSchemas + handlers; reinforced in Global Constraints. ✅
- §3 ratio maps → Task 1. ✅
- §4 stack/build (ESM, NodeNext, fetch, tsc, bin/shebang, engines, no dotenv) → Task 1 package.json/tsconfig + Task 8 shebang/bin. ✅
- §5 testing (vitest, ported pure-function surface + registration) → Tasks 1–8 test files. ✅
- §6 packaging/publish (version 0.2.0, CI typecheck+test, publish provenance) → Task 1 version, Task 9 workflows, post-impl release step. ✅
- §7 catalog repoint → Task 11. ✅
- §7 README rewrites + deletions + gitignore → Task 10. ✅
- §7 PyPI yank → post-impl manual step. ✅
- §8 risks (SDK error surfacing, registerTool API) → Task 8 SDK note. ✅

**2. Placeholder scan:** No `TBD`/`TODO`/"handle edge cases"/"similar to Task N"; every code step shows full code; every command shows expected output. ✅

**3. Type consistency:** `ToolDef` shape (`name`/`description`/`inputSchema`/`handler`) is identical across `tool-def.ts`, all module arrays, and `index.ts`'s `registerTool` call. `getClient`/`renderAssets`/`toImageField`/`SiliconFlowError`/`Settings`/`SiliconFlowClient` names match between Task 2/3 definitions and Tasks 4–7 consumers. `requestJson(method, path, { json?, params? })` and `requestBinary(...)→Buffer` signatures are consistent across client (Task 3) and all callers. ✅
