# Vercel 部署

应用使用 Next.js + 私有 Vercel Blob + Neon PostgreSQL + Workflow + Sandbox。所有转换任务都在独立的临时 Sandbox 执行；Vercel 上不运行本地 Worker，不使用 SQLite 或 Function 本地磁盘保存文件。

## 1. 导入应用

在 Vercel 导入仓库，设置：

| 配置                                        | 值                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Root Directory                              | `apps/web`                                                                          |
| Framework Preset                            | Next.js                                                                             |
| Node.js                                     | 24.x                                                                                |
| Install Command                             | 使用默认 pnpm 安装，保留仓库 lockfile                                               |
| Build Command                               | 由 `apps/web/vercel.json` 设置为 `pnpm --config.verify-deps-before-run=false build` |
| Output Directory                            | Next.js 默认值                                                                      |
| Include source files outside Root Directory | 开启，供共享工作区使用                                                              |

启用 Fluid Compute。`withWorkflow` 已接入 Next.js 配置，会生成并注册内部队列处理路由；不要手动改写或给 `/.well-known/workflow/` 添加登录拦截。`turbo.json` 已将这些生成文件纳入构建缓存。

未配置转换资源时基础工具可以运行，文件工具显示“转换服务未就绪”。Vercel 自动选择云模式，即使错误配置了 `CONVERSION_BACKEND=local` 也不会回退到实例磁盘。

## 2. 连接存储和数据库

在 Vercel Storage / Marketplace 创建并连接：

1. **Private Vercel Blob store**。必须是私有存储。为当前应用配置其 `BLOB_READ_WRITE_TOKEN`；当前客户端上传使用 Blob 的标准 `handleUpload` 协议，其授权签名需要这个服务端令牌。仅有 `BLOB_STORE_ID` 不足以启用当前上传接口。
2. **Neon PostgreSQL**。使用 Marketplace 注入的 `DATABASE_URL`。Preview 建议连接独立数据库分支及独立 Blob store。

这些值都不能使用 `NEXT_PUBLIC_` 前缀。浏览器只获得限定路径、大小和有效期的上传凭证，不能访问其他文件或覆盖已有输入。

在 `apps/web` 链接对应 Vercel 项目，并拉取 Development 环境变量：

```sh
vercel link
vercel env pull .env.local
```

从仓库根目录运行数据库初始化：

```sh
pnpm --config.verify-deps-before-run=false --filter web db:migrate
```

迁移脚本读取 `apps/web/.env.local`，在事务中创建表、索引和原子配额函数，可以重复执行。它不会在 `next build` 中自动修改数据库。Production / Preview 各自使用的数据库也需执行迁移；执行前确认 `DATABASE_URL` 指向目标环境。

## 3. 准备转换镜像

根目录的 `Dockerfile.conversion` 包含 Node.js 24、Sharp、pdf-lib、FFmpeg、LibreOffice Writer 和中日韩字体。镜像不含应用密钥，不含数据库驱动，也不会复制 `.env` 或用户文件。

在安装了 Docker 的机器或 CI 上，从仓库根目录构建。替换命令中的 `YOUR_VERCEL_PROJECT` 为已创建的项目名或 ID：

```sh
vercel vcr login docker --project YOUR_VERCEL_PROJECT
vercel vcr build docker . auden-conversion:v1 --project YOUR_VERCEL_PROJECT --platform linux/amd64 --push -- -f Dockerfile.conversion
```

`--` 后的参数传给 Docker；VCR/Sandbox 需要 `linux/amd64`。等待 VCR 中镜像状态变为 **Ready**，设置 `CONVERSION_SANDBOX_IMAGE=auden-conversion:v1`；正式环境建议使用构建后的不可变 digest。转换引擎或 `sandbox-runner.ts` 更新后，需要重建镜像并更新该变量。Vercel Sandbox 不执行 Docker 的 ENTRYPOINT/CMD，应用通过 SDK 启动固定的转换入口。[VCR CLI](https://vercel.com/docs/container-registry/cli-reference) · [Sandbox 镜像](https://vercel.com/docs/sandbox/concepts/images)

## 4. 环境变量

| 变量                        | 用途                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | Neon 数据库连接，必需                                                                                     |
| `BLOB_READ_WRITE_TOKEN`     | 私有 Blob 存储的服务端令牌，必需                                                                          |
| `CONVERSION_SANDBOX_IMAGE`  | 上一步的镜像引用，必需                                                                                    |
| `CRON_SECRET`               | 随机密钥，建议至少 32 字符，保护补偿清理接口                                                              |
| `APP_ORIGIN`                | 可选，Production 的精确来源，例如 `https://tools.example.com`，不能带尾斜杠；Preview 留空以接受其自身域名 |
| `CONVERSION_BACKEND=vercel` | 仅本地测试云模式时设置；Vercel 自动识别                                                                   |

Sandbox 在 Vercel 上使用部署的 OIDC 凭证，不需要长期 Vercel access token。配置变量后重新部署，让 Function 使用新配置。

本地测试真实云服务时，可在 `.env.local` 使用 `vercel env pull` 提供的 OIDC 令牌；失效后重新拉取。没有 OIDC 的本地/CI 环境才使用 `VERCEL_TOKEN`、`VERCEL_TEAM_ID`、`VERCEL_PROJECT_ID` 三项作为 Sandbox SDK 的显式凭证。它们不需要传入转换 Sandbox。

## 5. 任务与清理

1. 页面创建任务，服务器在 PostgreSQL 原子预留容量、检查会话配额并启动 Workflow。
2. 浏览器通过受限凭证将文件直传私有 Blob。每个输入路径由服务器生成，禁止覆盖；超过 4 MiB 的输入使用 multipart。普通 Function 不接收文件请求体。[Blob 客户端上传](https://vercel.com/docs/vercel-blob/client-upload)
3. 浏览器确认上传完成；服务器逐一 HEAD 校验预留路径和实际大小，然后原子入队。重复确认不会产生第二份转换。
4. Workflow 创建独立且不保存快照的 Sandbox。输入使用五分钟有效的只读签名地址下载；下载时仅允许访问对应 Blob 域名，转换前关闭全部外网访问。Sandbox 内没有 Blob/数据库/Vercel 管理凭证。
5. Workflow 读取进度，流式写回私有 Blob，保存结果，再停止 Sandbox。请求断开不影响后台任务；可随时取消。SDK/网络暂时故障由 Workflow step 重试，确定的转换错误返回对应错误文案。
6. 完成或失败后保留一小时，由 Workflow 的持久化定时等待触发清理。下载、列表和重试接口均检查会话与有效期。删除任务立即隐藏并清理，未到期的上传授权通过回调和延迟清理兜底。

`apps/web/vercel.json` 还配置每天一次 `/api/conversions/cleanup`，用于 Workflow 异常退出后的补偿；它不是正常的一小时清理机制。云服务故障可能使物理删除延后，但过期下载始终被拒绝。Cron 需要 `CRON_SECRET`，Preview 不依赖 Cron 来执行正常清理。Workflow 执行记录只传递任务 ID 和必要状态，不记录文件内容；完成后请求立即清除运行数据。

保留现有上限：上传五分钟，转换十分钟，视频 200 MiB / 十分钟 / 4K，输出 256 MiB，每会话两个活动任务和每小时二十次提交，全局预留容量 2 GiB。配额记录与任务分开存储，删除任务不恢复提交次数。这些是应用限制，不能代替云账号的预算配置。Blob、数据库、Workflow、Sandbox 和镜像存储按各自使用量计费。

## 6. 验证

无需云凭证即可执行：

```sh
pnpm --config.verify-deps-before-run=false --filter web test
pnpm --config.verify-deps-before-run=false --filter web lint
pnpm --config.verify-deps-before-run=false --filter web check-types
pnpm --config.verify-deps-before-run=false --filter web build
```

其中云存储测试在 PGlite 上实际执行 PostgreSQL schema/查询，并用真实图片执行 Sandbox 相同的转换入口。Vercel 构建会编译 Workflow，但不会创建 Sandbox、修改云数据库或上传文件。

连接真实资源后，可以对部署地址运行 HTTP 冒烟测试。脚本会上传自己的合成图片和 DOCX、验证下载隔离/重试/删除，并清理测试任务；它会实际使用转换资源：

```sh
pnpm --config.verify-deps-before-run=false --filter web test:http https://YOUR_DEPLOYMENT_DOMAIN
```

发布后用自己的测试样本验证：图片/PDF、带中文的 DOCX、MOV、提取音频；检查进度、刷新恢复、取消、失败重试、另一浏览器会话无法下载，以及到期后 Blob 和 Sandbox 均被清理。浏览器 Network 中大文件应直传 Blob，`/api/conversions` 只发送小型 JSON 请求。云端镜像构建、真实资源连接及端到端耗时需要在目标账号实测；本地测试不能替代这些检查。

遇到服务未就绪先检查三个必需变量；数据库报表不存在先执行迁移；`image_not_ready` 等待 VCR 准备完成；403 检查浏览器来源与 `APP_ORIGIN`；图片可转但文档/视频失败时确认发布的镜像包含全部转换引擎。不要把长期管理凭证放入页面或用户可下载的文件。

## 本地 / 自托管兼容

不设置 `CONVERSION_BACKEND` 且不在 Vercel 时，继续使用 SQLite + 独立 Worker，原有 Docker Compose 和 `test:http` 不变。旧的本地任务不会自动迁移到云存储；其短期文件仍由原 Worker 按保留期清理。
