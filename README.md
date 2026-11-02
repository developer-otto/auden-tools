# Auden Tools

基于 Next.js App Router 的日常工具平台，提供 14 个工具和简体中文、繁体中文、英语、日语、韩语。计算、文本和文件转换均在浏览器中完成；Next.js 仅提供页面和汇率获取/缓存接口。

**无需数据库、云存储、转换服务器、API Key 或环境变量。** 文件不上传，转换结果仅保存在当前页面内存中。

## 开发与验证

使用 Node.js 24.x 和仓库指定的 pnpm：

```sh
pnpm install
pnpm --filter web dev
```

打开 http://localhost:3000。开发与构建命令会自动准备同源的浏览器转换资源，不需要启动 Worker 进程或安装 FFmpeg / LibreOffice。

```sh
pnpm --filter web --config.verify-deps-before-run=false test
pnpm --filter web --config.verify-deps-before-run=false lint
pnpm --filter web --config.verify-deps-before-run=false check-types
pnpm --filter web --config.verify-deps-before-run=false build
pnpm --filter web --config.verify-deps-before-run=false test:browser
```

浏览器测试在 macOS 默认使用已安装的 Chrome；其他环境先执行 `pnpm --filter web exec playwright install chromium`，也可用 `PLAYWRIGHT_CHANNEL` 指定浏览器。测试会在 3010 端口启动生产构建；`PLAYWRIGHT_BASE_URL` 可指定已部署的网站。

## 工具

| 路径                   | 功能                                                     |
| ---------------------- | -------------------------------------------------------- |
| `/tools/timestamp`     | 秒/毫秒时间戳与本地时间互转，25 个 IANA 时区及夏令时处理 |
| `/tools/world`         | 世界时间、时区比较                                       |
| `/tools/date`          | 日期间隔、加减天数                                       |
| `/tools/currency`      | 24 种货币、国旗、交叉汇率及历史数据，不包含新台币        |
| `/tools/units`         | 长度、重量、温度等单位换算                               |
| `/tools/text`          | 计数、去重、排序、大小写等文本处理                       |
| `/tools/json`          | JSON 格式化、压缩，保留大数和小数精度                    |
| `/tools/image`         | JPG / PNG / WebP / AVIF 输入，PNG / JPG / WebP 输出      |
| `/tools/pdf-merge`     | 按文件顺序合并 PDF，最多 20 个文件、500 页               |
| `/tools/pdf-split`     | 按指定页码提取，去重并保留输入顺序                       |
| `/tools/images-pdf`    | 每张图片一页，A4 或适应图片尺寸                          |
| `/tools/word-pdf`      | DOCX 在浏览器渲染后导出图片型 PDF，最多 30 页            |
| `/tools/video-mp4`     | MOV / MP4 / MKV / WebM / M4V 转 MP4，兼容转码或快速封装  |
| `/tools/audio-extract` | 提取第一条音轨，输出 MP3 / M4A / WAV                     |

金额和单位计算使用 BigInt 定点/分数运算，汇率保留上游十进制字符串，只在最终显示时舍入。汇率来自 Frankfurter，界面显示数据日期，不伪装为交易级实时价格。

## 文件转换

- 图片及 PDF 使用独立 Web Worker，图片通过浏览器画布编码，PDF 使用 pdf-lib。
- 音视频使用单线程 ffmpeg.wasm，在独立 Worker 中执行；首次使用加载约 31 MB 的 WASM。引擎由本站提供，不依赖第三方 CDN，也不需要 COOP / COEP 配置。
- DOCX 使用 docx-preview 在禁止脚本与外部资源的 iframe 中渲染，再生成图片型 PDF。文字不可选中，字体取决于设备，复杂分页/表格可能不同。旧版 DOC、PDF 转 Word 暂不支持。
- 图片/PDF/DOCX 单文件最多 20 MiB；多个 PDF/图片合计最多 50 MiB；图片最多 2400 万像素。视频最多 100 MiB、5 分钟、1080p；结果最多 128 MiB。性能取决于设备，可取消转换。
- 当前工具页面保留最近 3 次结果，支持下载、重试和删除；刷新、跳转到其他工具或关闭页面会终止任务并释放结果。文件不进入数据库、云存储、Cookie 或 localStorage。
- 图片输出不包含原始元数据，JPG 的透明背景填充为白色。浏览器不支持的编码会明确报错，不把 PNG 静默改名为其他格式。

`lib/browser` 是本地转换实现；`scripts/prepare-browser-assets.mjs` 生成被 Git 忽略的 `public/conversion` 资源。源码、版本和依赖由 pnpm lockfile 锁定，Vercel 每次构建自动生成资源。

## Vercel 自动部署

GitHub 仓库已经连接 Vercel。推送 `main` 更新正式站，其他分支/PR 生成预览。Root Directory 使用 `apps/web`，Node.js 使用 `24.x`，允许访问根目录和共享工作区；无需设置数据库或转换环境变量。

完整配置见 [Vercel 部署说明](docs/vercel-deployment.md)。
