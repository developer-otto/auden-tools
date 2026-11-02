# Vercel 部署

应用采用 **Next.js + 浏览器本地文件转换**。不需要 Neon、Blob、Sandbox、Workflow、数据库迁移、转换镜像或清理 Cron，也不需要环境变量。

## 项目设置

| 设置                           | 值                                                 |
| ------------------------------ | -------------------------------------------------- |
| Framework Preset               | Next.js                                            |
| Root Directory                 | `apps/web`                                         |
| Node.js                        | `24.x`                                             |
| Install Command                | 自动检测 pnpm，使用仓库 lockfile                   |
| Build Command                  | `pnpm --config.verify-deps-before-run=false build` |
| 包含 Root Directory 外的源文件 | 开启，供共享 workspace 使用                        |
| Production Branch              | `main`                                             |

`apps/web/vercel.json` 提供构建命令。构建先生成浏览器 Worker 和 ffmpeg.wasm 静态文件，再执行 `next build`；需要保留 pnpm 的默认开发依赖安装，以运行构建工具 esbuild。

文件转换脚本和约 31 MB 的 WASM 由 Vercel 静态资源服务提供，只在用户启动转换时下载。没有文件上传 API，不受 Function 请求体或执行时间限制；转换速度和可处理大小由用户设备决定。

汇率通过 Next.js `/api/rates`、`/api/rates/history` 获取并缓存，使用免 Key 的 Frankfurter 数据。时间、金额计算和文件内容处理均在前端完成。

## 自动发布

项目连接 GitHub 的 `developer-otto/auden-tools` 仓库：推送 `main` 自动构建正式版本；推送其他分支或创建 PR 自动生成 Preview。无需额外 GitHub Actions、Vercel Token 或 Deploy Hook。

## 发布验证

1. 确认构建通过，正式首页及 `/api/rates` 返回成功。
2. 验证图片/PDF、DOCX、MOV 转 MP4 和音频提取。转换产生的下载地址应为 `blob:`，文件内容不发送到服务器。
3. 首次音视频转换会加载引擎，测试取消、重试、下载和删除。
4. 刷新或切换工具后记录清空；转换时应保持页面打开。

```sh
PLAYWRIGHT_BASE_URL=https://YOUR-DEPLOYMENT.vercel.app pnpm --filter web --config.verify-deps-before-run=false test:browser
```

测试只在测试浏览器内处理仓库中的合成样本，不创建数据库、存储桶或云端转换任务。若部署受到 Vercel Authentication 保护，先使用账号已有授权访问，不要为测试关闭保护。

DOCX 导出为图片型 PDF，文字不可选中；复杂排版可能不同。视频上限为 100 MiB、5 分钟、1080p，文件转换与数据库无关。
