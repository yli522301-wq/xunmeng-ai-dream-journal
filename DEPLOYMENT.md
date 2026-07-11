# 巡梦部署准备说明

这份文档用于项目完成后发布 GitHub、部署线上 Demo、提交比赛链接。

## 1. 提交前检查

```bash
git status --short
PORT=5173 BASE_PATH=/ pnpm run build
```

开源仓库提交前，再做一次密钥扫描：

```bash
git grep -n -E "OPENAI_API_KEY=.*[A-Za-z0-9]|ELEVENLABS_API_KEY=.*[A-Za-z0-9]|DATABASE_URL=.*://" -- ':!DEPLOYMENT.md' ':!SECURITY.md'
```

如果命令没有输出，说明已提交文件里没有匹配到这些常见密钥形态。

确认不会提交以下内容：

- `.env`
- `node_modules/`
- `venv/`
- `pretrained_models/`
- `test_output/`
- `VoxCPM/`
- 任何真实 API Key、数据库密码或平台 Token

真实密钥只配置在部署平台的 Environment Variables / Secrets 页面，不写进代码、不写进 README、不写进 Issue 或截图。

## 2. GitHub 提交流程

当前远端仓库：

```bash
git remote -v
```

应指向：

```text
https://github.com/yli522301-wq/xunmeng-ai-dream-journal.git
```

项目最终稳定后执行：

```bash
git add .
git commit -m "Prepare Xunmeng for competition deployment"
git push origin main
```

## 3. 推荐部署架构

### 方案 A：前后端分开部署

这是最稳妥的比赛 Demo 方案。

- Frontend: Vercel
- API server: Render / Railway / Fly.io
- Database: Neon / Supabase / Railway Postgres / Render Postgres

前端部署命令：

```bash
pnpm install
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xun-meng run build
```

前端输出目录：

```text
artifacts/xun-meng/dist/public
```

后端部署命令：

```bash
pnpm install
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

后端启动文件：

```text
artifacts/api-server/dist/index.mjs
```

后端环境变量至少设置：

```text
PORT=8080
NODE_ENV=production
BASE_PATH=/
OPENAI_API_KEY=...
AI_MODEL_NAME=gpt-4o
DATABASE_URL=...
ELEVENLABS_API_KEY=...
LOG_LEVEL=info
```

### 方案 B：先提交 GitHub 仓库，Demo 继续本地录屏

如果比赛允许代码仓库 + 演示视频，可以先完成 GitHub 整理，再补一个 Demo 视频或截图说明。但如果要求“大家都能使用”，仍建议使用方案 A。

## 4. Vercel 设置参考

Vercel 项目建议设置：

- Framework Preset: Vite
- Root Directory: 仓库根目录
- Install Command: `pnpm install`
- Build Command: `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/xun-meng run build`
- Output Directory: `artifacts/xun-meng/dist/public`

注意：如果前端需要直接访问独立后端，需要在代码或平台 rewrites 中让 `/api` 指向后端公网地址。当前本地开发依赖 Vite dev proxy，生产静态站点不会自动使用 `API_PROXY_TARGET`。

## 5. Render / Railway 后端设置参考

后端服务建议设置：

- Root Directory: 仓库根目录
- Build Command: `pnpm install && pnpm --filter @workspace/api-server run build`
- Start Command: `pnpm --filter @workspace/api-server run start`
- Health Check Path: `/api/health`

需要配置真实环境变量：

```text
PORT
NODE_ENV
DATABASE_URL
OPENAI_API_KEY
AI_MODEL_NAME
ELEVENLABS_API_KEY
LOG_LEVEL
```

`VOXCPM_TTS_URL` 只有在你单独部署 VoxCPM 服务时才需要配置。不要把本地模型权重上传到 GitHub。

## 6. 开源仓库密钥原则

- `.env.example` 可以提交，只放变量名和空值/示例值。
- `.env`、`.env.local`、`.env.production` 等真实配置文件不提交。
- OpenAI、ElevenLabs、数据库密码只保存在 Vercel/Render/Railway 的环境变量里。
- 如果密钥曾经误提交到 GitHub，不要只删除文件；应立即去对应平台轮换密钥，并清理 Git 历史。
- 参赛截图或录屏不要露出环境变量页面、API Key 页面和数据库连接串。

## 7. 比赛提交材料建议

提交前在 README 顶部补充：

- 线上 Demo 链接
- 项目一句话介绍
- 3-5 张截图或短视频链接
- 测试账号，如有
- 已知限制，如 AI Key 配额、语音服务可能冷启动等

推荐最终提交链接优先级：

1. 线上 Demo 链接
2. GitHub 仓库链接
3. 演示视频或截图文档
