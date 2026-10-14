# 开发与发布

本文集中记录维护者使用的开发约定、实现约束和发布流程。后续开发相关说明继续维护在本文件，不放入 README，也不从 README 链接到这里。README 只描述用户安装与使用。

## 分支约定

- `source`：源码、测试、构建配置、工作流和本文件。日常开发及 PR 面向此分支。
- `main`：GitHub 默认分支，仅保存最新正式 Release 的安装包内容及 `.release.json` 发布记录，由流水线更新。不要向它手动提交或合并源码。
- `v<version>` tag：指向 `source` 历史中的提交，版本须与 `package.json`、`package-lock.json` 一致。
- 暂不配置 GitHub 分支保护或专用 GitHub App。发布 job 使用仓库的 `GITHUB_TOKEN`，权限为 `contents: write`。

默认分支必须保持 `main`，这样 Desktop 插件界面填写仓库地址时，会安装流水线同步的正式版产物。官方安装器不会查询最新 Release；仓库入口与 Release 的内容一致由我们的流水线保证。

`docs/`、`src/`、测试和工作流不进入发布安装包，也不出现在产物分支的当前文件树中。公开仓库的源码分支及历史仍是公开的，此约定不构成访问控制。

## 本地开发

```sh
git switch source
npm ci
npm run typecheck
npm test
```

`npm test` 先构建再运行测试。`lib/` 是本地生成目录，不提交到 `source`。本地打包时先构建：

```sh
npm run build
npm pack
```

包不声明 `prepare`、安装钩子或自动打包构建钩子，避免 Git 安装触发 pnpm 构建授权。不要为方便开发重新添加这些钩子。

## 首次迁移

1. 将当前实现及工作流提交到 `source`，推送 `source` 到远端。
2. 确认仓库默认分支仍为 `main`，GitHub Actions 可以运行；发布 job 需要写入仓库内容的权限。
3. 在 `source` 的已提交版本上创建并推送第一个版本 tag。
4. 首次成功发布会在现有 `main` 历史上新增一个产物提交，用安装包内容替换其当前源码文件树，不强制推送、不删除历史。确认源码已存在远端 `source` 后再执行此步骤。

只有本地 tag 不会触发 GitHub Actions，必须把 tag 推送到远端。工作流从 tag 所指向的源码提交读取，因此 tag 必须包含工作流文件。

## 发布版本

在 `source` 中修改代码、通过测试并更新版本。后续版本可以执行：

```sh
npm version 0.1.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: release 0.1.1"
git push origin source
git tag v0.1.1
git push origin v0.1.1
```

以上是版本号示例；首次发布当前版本时无需重复修改版本，只需确认所有改动已提交、推送，再创建匹配的 tag。发布前等待该源码提交的 Check 工作流通过。不要移动或覆盖已发布的 tag。

Release 工作流依次执行：

1. 验证 tag 提交属于远端 `source` 的历史，且 tag、包和锁文件版本一致。
2. 安装开发依赖，执行类型检查、构建与测试。
3. 用 `npm pack` 生成 `dsh-oauth.tgz`，检查服务端入口、客户端入口和插件配置均包含在内。
4. 创建对应 GitHub Release 并上传安装包；带预发布后缀的版本标记为 Pre-release，不作为 latest。
5. 正式版发布成功后，从同一安装包提取文件，追加提交到 `main`。预发布版不更新 `main`。

`main` 中的 `.release.json` 记录版本、tag 和源码提交。发布较旧版本不会回退 `main`；同一版本的同一源码重试不会重复提交。每次只推送一个待发布 tag，等待完成后再发布下一个。

如果 Release 已成功但 `main` 同步失败，可以重跑工作流：它会下载已发布的安装包用于同步，不覆盖既有 Release 资产。若出现部分创建的 Release 缺少安装包，需先检查该 Release 并补齐或清理失败的发布，再重试。并发或手动推送造成的非快进更新会失败，不使用 force push 绕过；先检查远端 `main` 再重跑。

维护者本地的 `main` 在流水线发布后会落后于远端；日常继续在 `source` 开发，无需把产物合并回源码分支。

## 实现约束与验证

- 保留官方 `openai-codex`、`github-copilot` 服务商 ID；不增加别名，不修改 Harness 源码。
- OAuth 使用官方 pi-ai provider，凭据使用官方 `ctx.credentials`。不维护独立 token 文件或刷新逻辑。
- pi-ai 与共享 Harness 包声明为 peer dependency，开发测试另列 dev dependency。Harness 的运行时解析器提供宿主副本；不要重新安装一套 provider 运行时依赖。
- 当前接口验证基线为 Harness `0.2.1-alpha.2`、pi-ai `1.0.2`。升级依赖时需检查 OAuth、凭据提交和插件安装接口。
- 取消以官方凭据变更回调接受提交为边界；超时不提前释放仍在运行的 OAuth 操作锁，退出和卸载等待操作结束。
- 自动测试覆盖 OAuth 协调、界面状态、官方路由共存、安装包约束及发布分支同步。实际账号的 Desktop 授权、模型调用，以及 GitHub Actions 的线上发布仍需要单独验证。
