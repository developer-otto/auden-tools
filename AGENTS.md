<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": true` in the root `turbo.json` or `turbo.jsonc` to opt in; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

## 项目架构约束

以下约束适用于当前与后续所有工具功能：

- 优先在浏览器本地处理；需要服务端能力时，使用 Next.js 的页面、Route Handler 或其他内置能力进行即时处理并返回结果，不依赖独立转换服务或持久化任务队列。
- 不引入数据库，包括关系型数据库、SQLite、NoSQL、Redis/KV 等；也不依赖对象存储、云盘或服务器磁盘保存业务数据。
- 用户输入、文件、转换结果和任务记录仅用于当前处理流程，不持久化、不建立服务端历史记录，不写入日志或分析事件。处理完成、取消或离开页面后，及时释放不再需要的内存、Worker 和 Blob URL。
- Next.js 服务端逻辑保持无状态，不依赖跨请求内存、实例磁盘或后台常驻进程恢复任务。浏览器内存中的临时文件系统属于本地计算过程，不得改为持久化文件存储。
- 当前已有的语言、主题、收藏、常用币种/城市等界面偏好仅保存在浏览器本机，不存放工具输入、文件或转换结果，不做云端同步。公共汇率和静态资源可使用框架自带缓存，不将用户处理内容放入共享缓存。
- 会员数据是未来唯一可单独评估数据库的例外；当前不开发会员功能，也不提前加入账号表、数据库 SDK、迁移或存储基础设施。仅在用户明确启动会员需求后重新评估。
- 当新功能无法在上述范围内可靠完成时，调整实现方式、限制支持范围并说明边界，不默认增加数据库或存储服务。
