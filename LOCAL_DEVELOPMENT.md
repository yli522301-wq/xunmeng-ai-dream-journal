# 巡梦本地开发约定

## 唯一正式工作目录

`/Users/charlie/Desktop/巡梦 产品/xunmeng-ai-dream-journal`

后续功能开发、调试、构建和 Git 提交都只在这个目录进行。

`/Users/charlie/Desktop/巡梦-完整版本` 仅作为历史备份，不再直接修改或启动。

## 启动

```bash
cd "/Users/charlie/Desktop/巡梦 产品/xunmeng-ai-dream-journal"
npm run dev:xunmeng
```

- 巡梦前端：http://localhost:3001
- 巡梦 API：http://localhost:8080

这条命令会同时启动前端与 API 服务，按 `Ctrl+C` 可一起停止。

## 粒子原型

旧粒子实验文件已集中到：

`references/particle-prototype/cover-particles.html`

该文件只作视觉和 Shader 参考；正式功能代码位于 `artifacts/xun-meng/src/`。

## 本地语音服务

VoxCPM 模型与虚拟环境体积较大，继续作为独立本地服务维护。项目需要方言合成时，另行启动 8808 端口的 VoxCPM 服务。
