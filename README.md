# DSHOAuth

为 DeepSeek Harness 的 **设置 → Models** 页面添加 OpenAI Codex 和 GitHub Copilot 的 OAuth 登录入口，支持 Desktop 和 Web。

插件使用 Harness 原有的 `openai-codex` 和 `github-copilot` 服务商入口，复用官方 OAuth 流程和凭据存储，无需修改 Harness 源码。

## 使用要求

- DeepSeek Harness 0.2.1 系列及兼容版本，不支持旧版接口。
- 已安装并启动过 DeepSeek Harness Desktop，或已配置 Web 服务。
- 可用于对应服务的 OpenAI 或 GitHub 账号。

## 安装

插件提供预构建版本，无需在本机编译或为 DSHOAuth 配置 `allowBuilds`。

### 在 Desktop 界面安装

首个正式版本发布后：

1. 打开 Desktop 的插件管理界面，点击 **添加插件**，选择 **安装第三方插件**。
2. 在 **包名或地址** 输入框中粘贴下方链接，点击 **安装**，安装最新正式版。
3. 按界面提示完成安装；如果提示需要重启，请重启 Desktop。

```text
https://github.com/StarlightC/DSHOAuth
```

如需指定版本，将下面的 `<tag>` 替换为已发布的版本 tag（例如 `v0.1.0`）：

```text
https://github.com/StarlightC/DSHOAuth/releases/download/<tag>/dsh-oauth.tgz
```

仓库地址用于安装最新正式版；指定版本时使用对应 Release 的安装包直链。Web 的插件管理界面也可使用相同地址。

### 通过命令行安装

如果使用 `dsh` 命令，安装到 Desktop profile 前请完全退出 Desktop：

```sh
dsh plugin --profile desktop add github:StarlightC/DSHOAuth
```

安装到 Web profile 时，将 `--profile desktop` 改为 `--profile web`。

### 从本地安装包安装

也可以从对应 GitHub Release 的 Assets 中下载 `dsh-oauth.tgz`，在插件管理界面的安装地址输入框中填写该文件的绝对路径，或通过命令安装：

```sh
dsh plugin --profile desktop add ./dsh-oauth.tgz
```

## 登录与使用

1. 安装后重开 Desktop，或重启对应的 Web 服务。
2. 打开 **设置 → Models**，找到 `openai-codex` 或 `github-copilot`。尚未添加的服务商可从 Models 的添加流程中选择。
3. 点击 **登录 / Sign in**，按页面提示选择授权方式、打开授权链接或输入验证码。GitHub 的企业域名输入框留空即可使用 github.com。
4. 完成授权后，返回 Models 页面查看登录状态，并按 Harness 的原有方式启用所需模型。

登录不会自动修改模型配置。需要切换账号时，可点击 **退出登录 / Sign out** 后重新登录。
