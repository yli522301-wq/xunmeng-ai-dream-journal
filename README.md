# 巡梦 AI Dream Journal

巡梦是一个 AI 梦境陪伴 Web App。用户可以记录梦境、创建专属陪伴角色，并通过 AI 对话、梦境整理、图片识别和语音回复探索梦境里的情绪与线索。

## 在线参赛链接

部署完成后把线上地址放在这里：

- Demo: https://yli522301-wq.github.io/xunmeng-ai-dream-journal/
- GitHub: https://github.com/yli522301-wq/xunmeng-ai-dream-journal

## 核心功能

- 梦境记录：输入或语音记录梦境内容，保存心情、清晰度、意象等信息。
- AI 梦境整理：调用 OpenAI 生成梦境摘要、象征元素和陪伴式回应。
- 角色陪伴：创建不同人格、语气和语言风格的梦境陪伴者。
- AI 聊天：围绕梦境继续对话，支持角色化回复。
- 图片识别：上传图片后提取可用于梦境记录的元素。
- 语音体验：支持浏览器语音能力、ElevenLabs，以及本地可选 VoxCPM TTS 服务。

## 技术栈

- Monorepo: pnpm workspace
- Frontend: React, Vite, Tailwind CSS, Framer Motion, wouter
- Backend: Express 5, TypeScript, Zod
- Database: PostgreSQL, Drizzle ORM
- AI: OpenAI API, ElevenLabs API
- API contract: OpenAPI + Orval codegen

## 本地运行

需要 Node.js 和 pnpm。

```bash
pnpm install
cp .env.example .env
```

填写 `.env` 后启动后端：

```bash
pnpm --filter @workspace/api-server run dev
```

另开一个终端启动前端：

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xun-meng run dev
```

前端默认把 `/api` 代理到 `http://localhost:8080`。如需修改，设置 `API_PROXY_TARGET`。

## 构建检查

```bash
PORT=5173 BASE_PATH=/ pnpm run build
```

单独构建：

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xun-meng run build
pnpm --filter @workspace/api-server run build
```

## 环境变量

复制 `.env.example` 到 `.env`，本地填入真实值。不要提交 `.env`。

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `PORT` | 是 | 后端端口；前端 Vite dev/preview 也要求该变量。 |
| `BASE_PATH` | 是 | 前端部署路径，普通域名用 `/`。 |
| `API_PROXY_TARGET` | 本地开发 | 前端 dev server 的 `/api` 代理目标。 |
| `DATABASE_URL` | 可选 | PostgreSQL 连接串；未配置时部分数据能力使用降级逻辑。 |
| `OPENAI_API_KEY` | 可选但推荐 | 开启真实 AI 分析、聊天和识图。 |
| `AI_MODEL_NAME` | 可选 | 默认 `gpt-4o`。 |
| `ELEVENLABS_API_KEY` | 可选 | 开启 ElevenLabs 语音回复。 |
| `VOXCPM_TTS_URL` | 可选 | 本地 VoxCPM TTS 服务地址。 |
| `VOXCPM_TIMEOUT_MS` | 可选 | VoxCPM 请求超时时间。 |
| `LOG_LEVEL` | 可选 | 后端日志级别。 |

## 部署建议

比赛提交建议使用线上 App 链接，而不是只提交仓库链接。这个项目包含前端和后端，推荐：

- 前端部署到 Vercel。
- 后端部署到 Render、Railway 或 Fly.io。
- 数据库使用 Neon、Supabase、Railway Postgres 或 Render Postgres。
- 在前端部署环境中把 API 请求指向后端公网地址，或在同域平台上配置 `/api` 代理。

更详细步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 仓库注意事项

以下内容不应提交到 GitHub：

- `.env` 和任何真实密钥。
- `node_modules/`、`venv/` 等本地依赖目录。
- `pretrained_models/` 等大模型权重。
- `test_output/` 等本地生成音频。
- `VoxCPM/` 本地 TTS 服务 checkout。需要时单独部署或作为外部服务说明。
