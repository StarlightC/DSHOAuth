# DSHOAuth

为 DeepSeek Harness 的 **设置 → Models** 页面添加 OpenAI Codex 和 GitHub Copilot 的 OAuth 登录入口，支持 Desktop 和 Web。

插件使用 Harness 原有的 `openai-codex` 和 `github-copilot` 服务商入口，复用官方 OAuth 流程和凭据存储，无需修改 Harness 源码。

## 使用要求

- DeepSeek Harness 0.2.1 系列及兼容版本，不支持旧版接口。
- 已安装 `dsh` 命令，并初始化要使用的 Desktop 或 Web profile。
- 可用于对应服务的 OpenAI 或 GitHub 账号。

## 安装

安装到已初始化的 Desktop profile，安装前须完全退出 Desktop。可选择 GitHub 源码安装或本地安装包。

### 从 GitHub 安装

执行以下命令：

```sh
dsh plugin --profile desktop add github:StarlightC/DSHOAuth
```

从 GitHub 安装时需要在本机自动构建插件。如果提示构建被阻止，请按报错中的确切包键，在目标 profile 的 `pnpm-workspace.yaml` 中合并以下配置，保留原有设置：

```yaml
allowBuilds:
  dsh-oauth: true
```

随后重新执行安装命令。该配置允许安装时执行插件构建代码。

如需固定版本，将下面的 `<commit-sha>` 替换为仓库中对应提交的完整 SHA：

```sh
dsh plugin --profile desktop add 'github:StarlightC/DSHOAuth#<commit-sha>'
```

Web 使用同一方式安装，将 `--profile desktop` 改为 `--profile web`；构建授权也应配置在对应的 Web profile 中。

### 从本地安装包安装

如果已有插件的 `.tgz` 安装包，也可以直接安装。将路径替换为实际文件位置：

```sh
dsh plugin --profile desktop add ./dsh-oauth-0.1.0.tgz
```

## 登录与使用

1. 安装后重开 Desktop，或重启对应的 Web 服务。
2. 打开 **设置 → Models**，找到 `openai-codex` 或 `github-copilot`。尚未添加的服务商可从 Models 的添加流程中选择。
3. 点击 **登录 / Sign in**，按页面提示选择授权方式、打开授权链接或输入验证码。GitHub 的企业域名输入框留空即可使用 github.com。
4. 完成授权后，返回 Models 页面查看登录状态，并按 Harness 的原有方式启用所需模型。

登录不会自动修改模型配置。需要切换账号时，可点击 **退出登录 / Sign out** 后重新登录。
