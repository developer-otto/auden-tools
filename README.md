# Auden Tools

一个基于 Next.js App Router 的日常工具平台，目前有 14 个工具、5 种语言。日常计算与文本处理在浏览器完成；Next.js 获取汇率及提供文件任务 API。推荐部署到 **Vercel**：私有 Blob 接收浏览器直传，Neon PostgreSQL 保存任务，Workflow 调度 Sandbox 转换。汇率无需 API Key。本地开发仍可使用 SQLite + Worker，无需配置云服务。

## Vercel 部署

导入仓库，Root Directory 选择 **`apps/web`**，Framework 选择 Next.js，Node.js 选择 **24.x**，保留对根目录及共享工作区的访问。安装使用仓库的 pnpm lockfile；构建命令由 `apps/web/vercel.json` 提供。基础工具不依赖转换服务，未配置云端资源时文件工具显示服务未就绪。

文件转换需连接私有 Vercel Blob、Neon 数据库，并发布包含 FFmpeg / LibreOffice 的 Sandbox 镜像。具体环境变量、数据库初始化、镜像构建、上线验证及清理策略见 **[Vercel 部署说明](docs/vercel-deployment.md)**。

## 本地运行

需要 Node.js 24+、pnpm 11.25.0。

```sh
pnpm install
pnpm --filter web dev
# 在第二个终端运行文件转换进程
pnpm --filter web worker
```

访问 <http://localhost:3000>。如依赖已经安装，且希望避免 pnpm 11 在运行脚本前自动重新安装，可使用 `pnpm --config.verify-deps-before-run=false --filter web dev`。

```sh
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web check-types
pnpm --filter web build
pnpm --filter web start
```

部署时保留 Next.js Node.js 服务端能力，不能使用纯静态导出。运行环境需能访问 `https://api.frankfurter.dev`。在需要系统代理的 Node.js 24 环境，可按本机配置设置 `NODE_USE_ENV_PROXY=1`；项目没有写死代理地址。

图片与 PDF 功能安装依赖后即可运行。音视频需要 `ffmpeg` 与 `ffprobe`，Word 需要 LibreOffice。Worker 启动时检测这些程序；缺少引擎时对应按钮禁用并说明原因，其他工具仍可使用。macOS 默认从 `/Applications/LibreOffice.app/Contents/MacOS/soffice` 读取 LibreOffice，其他系统默认从 PATH 读取 `soffice`。

可参考 `apps/web/.env.example`，在 `apps/web/.env.local` 配置 `FFMPEG_PATH`、`FFPROBE_PATH`、`LIBREOFFICE_PATH`。Next.js 和 Worker 必须使用同一个 `CONVERSION_DATA_DIR`，默认是 `apps/web/.data/conversions`；Worker 脚本也会加载 `.env.local`。启动后改变引擎路径需要重启 Worker。无需文件功能时，可以只运行 Next.js。

## 当前功能

| 路由                   | 功能                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `/`                    | 工具搜索、分类、收藏、最近使用、时钟与汇率预览                               |
| `/tools/timestamp`     | 秒/毫秒时间戳双向转换，25 个时区，夏令时重复时间选择与不存在时间提示         |
| `/tools/world`         | 24 个常见城市的实时钟表、12/24 小时制、跨时区会议对照                        |
| `/tools/currency`      | 24 种常见货币、旗帜、基础币种切换、多个目标币种、30 天历史走势               |
| `/tools/units`         | 长度、重量、温度换算                                                         |
| `/tools/date`          | 日期间隔、增加或减少天数                                                     |
| `/tools/text`          | 字符/汉字/行统计、去重、空行清理、排序、大小写转换                           |
| `/tools/json`          | JSON 格式化、压缩、校验，保留原始数字字面量                                  |
| `/tools/image`         | JPG / PNG / WebP / AVIF 相互转换，质量设置、透明度处理、自动旋转并移除元数据 |
| `/tools/pdf-merge`     | 按文件列表顺序合并 PDF，支持上下调整顺序                                     |
| `/tools/pdf-split`     | 输入 `1-3,5` 等页码，按输入顺序提取到一份新 PDF，自动去重                    |
| `/tools/images-pdf`    | 每张图片一页，A4 自动横竖向或适应图片尺寸                                    |
| `/tools/word-pdf`      | DOC / DOCX 转 PDF；暂不支持 PDF 转 Word                                      |
| `/tools/video-mp4`     | MOV / MP4 / MKV / WebM / M4V 转 MP4：H.264 + AAC 转码或快速封装              |
| `/tools/audio-extract` | 提取视频第一条音轨为 MP3、M4A 或 WAV                                         |

支持简体中文、繁体中文、英语、日语、韩语，以及深浅主题和手机布局。语言和主题保存在 Cookie，供服务端首屏读取；收藏、城市和币种偏好使用带版本号的 localStorage。关闭本地存储后仍可在当前会话使用工具。

币种：CNY、USD、EUR、JPY、GBP、HKD、KRW、SGD、AUD、CAD、CHF、NZD、THB、MYR、IDR、VND、INR、AED、SAR、SEK、NOK、ZAR、BRL、MXN。**不包含 TWD。** 国旗使用系统 Emoji，外观取决于设备字体。

## 汇率与精度

- `GET /api/rates`：以 CNY 为基准的汇率快照。上游使用 [Frankfurter v2](https://frankfurter.dev/) 的每日参考数据，服务端缓存一小时。各币种实际发布日期单独展示。
- `GET /api/rates/history?base=CNY&quote=USD`：最近 30 天历史数据。参数只接受支持的币种，同币种或无效参数返回 400。
- 汇率是每日参考值，不是实时交易报价。网络故障返回 503，界面提供重试；不会将示例数据伪装成实时数据。手动刷新仍遵守服务端缓存。
- 上游数字通过 Node.js 的 JSON reviver `context.source` 读取原始十进制文本，然后以字符串传到浏览器。
- 金额与单位使用 BigInt 有理数运算，中间过程不使用浮点数。金额按币种标准小数位在最后一步四舍五入；单位结果最多显示 8 位小数。金额支持最多 200 位数字，指数范围为 ±100。
- 时间戳使用整数毫秒并检查 Date 与安全整数边界；时区使用 IANA 标识和所选日期对应的规则。时间戳反向输入支持公元 0001–9999 年。
- JSON 仅通过解析检查语法；格式化基于原始 token，保留超大整数、长小数、指数、重复键和负零。
- 汇率走势仅在绘图坐标计算时使用 Number，金额和百分比结果保持十进制精度。

## 代码结构与验证

`apps/web/app` 放页面和 API 路由；`components/tools` 放工具界面；`lib` 放五语言文案、目录、纯计算逻辑及服务端适配器。`lib/server/conversions/cloud` 提供 Vercel 存储、数据库及 Sandbox 适配；`workflows/conversion.ts` 管理上传等待、转换和到期清理；`scripts/sandbox-runner.ts` 在隔离环境执行转换。原 `scripts/conversion-worker.ts` / `conversion-job.ts` 用于本地和自托管。

`tests/core.test.ts` 覆盖舍入边界、大额金额、576 种货币交叉换算、25 个时区往返、夏令时、日期边界、JSON 精度和五语言占位符。`tests/conversions.test.ts` 用真实图片、PDF、MOV 和 DOCX 检查输出，以及流式上传、文件名处理、页序、队列独占、会话校验和到期删除；未安装的外部引擎会明确显示为 skipped。所有样本均为测试生成，不含用户文档。

启动 Next.js 和 Worker 后，运行 `pnpm --filter web test:http` 验证实际 HTTP 上传、任务恢复、下载、跨会话访问隔离、失败重试和取消。该测试创建自己的临时任务并在结束时删除。

`tests/cloud-conversions.test.ts` 使用 PGlite 执行真实 PostgreSQL schema 和查询，验证上传授权边界、原子配额、删除后限流、幂等提交、会话隔离及取消竞态，并实际运行 Sandbox 使用的转换入口。它不创建云资源；真实 Blob / Neon / Sandbox 集成仍需部署后验证。

## 文件转换的运行方式

Vercel 模式：

```text
浏览器 → Next.js 预留任务 → Neon PostgreSQL
   ↓                            ↑
私有 Blob 直传 → 完成校验 → Workflow → 临时 Sandbox
   ↑                                      ↓
   └────────────── 流式存储转换结果 ──────────┘
浏览器 ← 会话校验后流式下载
```

上传不经过 Vercel Function 请求体，保留 200 MiB 视频上限。Workflow 在发放上传授权前启动，负责上传超时、转换进度、失败处理及一小时后清理；关闭页面不影响转换。每个任务有独立 Sandbox，下载文件后禁止外网，转换结束停止且不保存文件快照。用户删除立即隐藏任务、停止 Sandbox 并删除 Blob；仍在途的上传通过签名回调和延迟清理回收。每天的 Cron 用于异常后的补偿清理。文件一到期，下载接口立即拒绝访问；云服务故障可能延后物理删除。

本地模式：

```text
浏览器 → Next.js 流式上传 → 共享磁盘 + SQLite 队列
                               ↓
                    Worker → 独立转换子进程
                               ↓
浏览器 ← 会话校验后流式下载 ← 转换结果
```

- 文件只在点击转换后上传。任务凭证保存在 HttpOnly、SameSite Cookie，数据库只记录凭证哈希。列表、状态、重试、取消和下载均校验所属会话；下载不使用公开文件地址。
- 上传最多 5 分钟，单任务执行最多 10 分钟。每个 Worker 同时执行一个任务；取消或超时会终止整个转换进程组。运行中的任务不依赖页面保持打开。失败任务可在有效期内重试，无需重复上传。
- 完成/失败后保留 1 小时，可立即删除。Worker 每 15 秒清理到期文件；**Worker 停止时无法执行物理清理**，但 API 仍拒绝已过期的下载，重启后补做清理。SQLite 日志不作为长期文件备份。
- 单张图片、单个 PDF、单个 Word 文件上限 20 MiB。PDF 合并或图片转 PDF 最多 20 个文件、总计 50 MiB；PDF 总页数最多 500 页；图片解码最多 4000 万像素。
- 视频上限 200 MiB、10 分钟、4K 像素量。输出上限 256 MiB；MP4 保留第一条视频轨和第一条音轨。兼容模式有损转码；快速封装仅接受 H.264 + AAC（或无音轨），不会自动转为有损模式。
- 每个会话最多 2 个活动任务，最多保留最近一小时的 20 条提交记录；全局最多 100 个任务，按输入和输出预留 2 GiB 存储预算。该预算用于限制队列，不代替磁盘配额。面向公网时，应在入口代理设置访问频率与磁盘配额。
- PDF 合并和提取面向静态页面：不保证保留目录、签名或交互表单，暂不支持密码 PDF。图片转 PDF 不含 OCR；动画图片不支持。Word 排版受字体影响，需要复核复杂表格、分页和特殊字体。PDF 转 Word 留待后续单独评估。

## 自托管部署

本地 SQLite + Worker 适配器面向**单台主机**，需要持久磁盘和可启动本地程序的 Node.js 运行环境。Vercel 上自动使用上面的云端适配器，不会回退到实例本地磁盘；自托管时默认使用本地模式。

仓库提供 `Dockerfile` 和 `compose.yaml`：Web 与 Worker 分开运行，共用持久卷。Worker 镜像包含 FFmpeg、LibreOffice 及中日韩字体，使用无网络容器、非 root 用户、只读根文件系统和 CPU/内存限制。

```sh
# 默认访问 http://localhost:3000
docker compose up --build -d

# 使用域名和 HTTPS 反向代理时，将来源改为实际访问域名
APP_ORIGIN=https://tools.example.com docker compose up --build -d
```

反向代理需允许至少 201 MiB 请求体、至少 5 分钟上传时间，并保留 Origin 和 Cookie。`APP_ORIGIN` 必须与浏览器访问地址完全一致，含协议与非默认端口且不带末尾斜杠。清理依赖 Worker 持续运行；监控磁盘空间并限制卷容量。SQLite 和文件卷只挂到此平台进程，不能映射为静态公开目录。

本机未安装 Docker，容器构建尚未实测；本地 Node.js + FFmpeg + LibreOffice 的完整流程已通过测试。

早期静态设计稿保留在 `design/auden-tools-v1`，其中汇率是演示数据；正式产品以 `apps/web` 为准。仓库中的 `apps/docs` 和共享包保留现有结构。
