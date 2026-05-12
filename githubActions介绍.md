# GitHub Actions 是什么？

[GitHub Actions 官方文档](https://docs.github.com/actions?utm_source=chatgpt.com)

GitHub Actions 是 GitHub 提供的一套：

> **CI/CD（持续集成 / 持续部署） + 自动化工作流平台**

它允许你：

* 自动测试代码
* 自动构建项目
* 自动部署服务器
* 自动发布版本
* 自动执行脚本
* 自动同步、通知、检查等

本质上：

> GitHub Actions = “代码仓库里的自动机器人”

只要发生某个事件（比如 push 代码），它就会自动执行一系列任务。

---

# 一、GitHub Actions 的核心结构

整个结构：

```text
Workflow
 ├── Event
 ├── Job
 │    ├── Step
 │    │     └── Action
 │
 └── Runner
```

你可以理解成：

| 概念       | 类比      |
| -------- | ------- |
| Workflow | 一个自动化流程 |
| Event    | 触发条件    |
| Job      | 一个任务    |
| Step     | 任务中的步骤  |
| Action   | 可复用功能模块 |
| Runner   | 执行机器    |

---

# 二、Workflow（工作流）

## 1. 什么是 Workflow？

Workflow（工作流）：

> 一整套自动化流程

它是 GitHub Actions 的最顶层。

例如：

* push 代码后自动测试
* 提交 PR 后自动检查
* 发布 tag 后自动部署

这些都属于 Workflow。

---

## 2. Workflow 放在哪里？

固定目录：

```text
.github/workflows/
```

例如：

```text
.github/workflows/deploy.yml
```

---

## 3. 一个最简单 Workflow

```yaml
name: Hello Workflow

on: push

jobs:
  hello:
    runs-on: ubuntu-latest

    steps:
      - name: 输出一句话
        run: echo "Hello GitHub Actions"
```

含义：

| 字段      | 含义          |
| ------- | ----------- |
| name    | 工作流名字       |
| on      | 触发事件        |
| jobs    | 要执行的任务      |
| runs-on | 使用什么机器      |
| steps   | 执行步骤        |
| run     | 执行 shell 命令 |

---

# 三、Event（事件）

## 1. 什么是 Event？

Event：

> 什么情况下触发 Workflow

也叫 Trigger（触发器）。

---

## 2. 常见事件

## push

代码提交：

```yaml
on: push
```

---

## pull_request

PR 创建/更新：

```yaml
on: pull_request
```

---

## workflow_dispatch

手动触发：

```yaml
on: workflow_dispatch
```

GitHub 页面会出现：

```text
Run workflow
```

按钮。

---

## schedule

定时任务（cron）

```yaml
on:
  schedule:
    - cron: "0 0 * * *"
```

每天执行一次。

---

## release

发布版本时：

```yaml
on:
  release:
    types: [published]
```

---

## issues

Issue 创建时：

```yaml
on:
  issues:
    types: [opened]
```

---

# 四、Job（作业）

## 1. 什么是 Job？

Job：

> Workflow 中的一组任务

一个 Workflow 可以有多个 Job。

例如：

```text
Workflow
 ├── test
 ├── build
 └── deploy
```

---

## 2. Job 特点

### Job 默认并行

```yaml
jobs:
  test:
  build:
```

会同时执行。

---

### Job 可以依赖

```yaml
jobs:
  build:
    ...

  deploy:
    needs: build
```

deploy 等 build 完成。

---

## 3. Job 示例

```yaml
jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - run: npm test

  build:
    runs-on: ubuntu-latest

    steps:
      - run: npm run build
```

---

# 五、Step（步骤）

## 1. 什么是 Step？

Step：

> Job 中的一个执行步骤

例如：

```text
Job
 ├── 安装依赖
 ├── 执行测试
 └── 打包项目
```

每个都是 Step。

---

## 2. 两种 Step

## run

直接执行 shell：

```yaml
- run: npm install
```

---

## uses

使用 Action：

```yaml
- uses: actions/checkout@v4
```

---

## 3. Step 示例

```yaml
steps:
  - name: 拉取代码
    uses: actions/checkout@v4

  - name: 安装依赖
    run: npm install

  - name: 运行测试
    run: npm test
```

---

# 六、Action（动作）

## 1. 什么是 Action？

Action：

> 可复用的自动化模块

别人已经封装好了功能。

你直接拿来用。

类似：

```text
npm package
Docker image
Vue 组件
```

---

# 2. 官方 Marketplace

[GitHub Marketplace](https://github.com/marketplace?type=actions&utm_source=chatgpt.com)

可以搜索：

* Docker
* Node.js
* Go
* Deploy
* SSH
* AWS
* Telegram
* Slack

等各种 Action。

---

# 3. 常见 Action

## actions/checkout

拉代码：

```yaml
- uses: actions/checkout@v4
```

---

## actions/setup-node

安装 Node：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
```

---

## actions/cache

缓存依赖：

```yaml
- uses: actions/cache@v4
```

---

## appleboy/ssh-action

SSH 部署服务器：

```yaml
- uses: appleboy/ssh-action@v1
```

---

# 七、Runner（运行器）

## 1. 什么是 Runner？

Runner：

> 真正执行 Workflow 的机器

GitHub 会启动一台临时服务器执行任务。

---

## 2. 官方 Runner

```yaml
runs-on: ubuntu-latest
```

还支持：

```yaml
windows-latest
macos-latest
```

---

## 3. 自托管 Runner

你也可以：

* 自己电脑
* 自己服务器
* NAS
* 内网机器

作为 Runner。

叫：

```text
Self-hosted Runner
```

适用于：

* 内网部署
* GPU
* 特殊环境
* 高性能编译

---

# 八、完整工作流示例

## Node.js 自动测试 + 构建

```yaml
name: Node CI

on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: 拉取代码
        uses: actions/checkout@v4

      - name: 安装 Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: 安装依赖
        run: npm install

      - name: 运行测试
        run: npm test

      - name: 打包
        run: npm run build
```

---

# 九、GitHub Actions 的典型应用场景

---

# 1. CI（持续集成）

最经典用途。

## 自动：

* lint
* test
* build

例如：

```text
push -> 自动测试
```

避免坏代码进入主分支。

---

# 2. CD（持续部署）

自动部署。

例如：

```text
push main
  ↓
build
  ↓
docker build
  ↓
ssh 上传服务器
  ↓
重启服务
```

---

# 3. 自动发布 Release

例如：

```text
git tag v1.0.0
```

自动：

* 构建
* 打包
* 上传附件
* 生成 changelog

---

# 4. Docker 自动构建

例如：

自动：

* build image
* push DockerHub
* push GHCR

---

# 5. 前端自动部署

你作为前端开发者会很常用。

例如：

## Vue / React 自动部署

```text
push main
  ↓
npm build
  ↓
上传 dist/
  ↓
部署 nginx
```

---

# 6. Go 自动构建

你现在在学 Go，会非常有用。

例如：

```text
push tag
  ↓
交叉编译
  ↓
生成：
  - windows exe
  - linux binary
  - mac binary
```

---

# 7. 自动代码检查

例如：

* ESLint
* Prettier
* GolangCI-Lint

PR 时自动检查。

---

# 8. 自动化机器人

例如：

## 自动回复 Issue

```text
新 issue
  ↓
自动回复模板
```

---

## 自动打标签

```text
bug
feature
question
```

---

# 9. 定时任务

例如：

每天凌晨：

* 抓取数据
* 自动备份
* 自动同步
* 定时爬虫
* 自动签到

---

# 10. 自动通知

例如：

* Slack
* Telegram
* 邮件
* 企业微信

部署完成后通知。

---

# 十、GitHub Actions 的优势

| 优势             | 说明                  |
| -------------- | ------------------- |
| 与 GitHub 深度集成  | 无需额外平台              |
| 免费额度高          | 小项目够用               |
| YAML 简洁        | 容易维护                |
| Marketplace 丰富 | 大量现成 Action         |
| 云端执行           | 不占本地资源              |
| 跨平台            | Linux/Windows/macOS |
| 社区成熟           | 教程非常多               |

---

# 十一、GitHub Actions 的局限

| 局限             | 说明     |
| -------------- | ------ |
| YAML 容易复杂      | 大项目会变长 |
| Debug 不如本地方便   | 有时排查困难 |
| 免费分钟有限         | 私有仓库注意 |
| 云 Runner 有性能限制 | 大编译可能慢 |
| Secrets 管理需谨慎  | 防止泄露   |

---

# 十二、前端开发者最实用的几个场景

结合你目前：

* 前端
* React/Vue
* Go 后端学习

推荐优先掌握：

---

## 第一阶段

### 自动：

* npm test
* npm build
* eslint

---

## 第二阶段

### 自动部署：

* VPS
* Nginx
* Docker

---

## 第三阶段

### Go 服务：

* 自动交叉编译
* 自动发布 Release
* Docker 镜像发布

---

# 十三、你现在可以这样理解 GitHub Actions

一句话：

```text
事件触发 → 工作流 → 作业 → 步骤 → 动作 → Runner执行
```

完整流程：

```text
push代码
   ↓
Event触发
   ↓
Workflow启动
   ↓
Job执行
   ↓
Step逐步运行
   ↓
Action完成具体功能
   ↓
Runner真正执行
```

---

# 十四、建议你的学习路线（前端 → Go）

## 第一步（最重要）

学会：

```yaml
on
jobs
steps
run
uses
```

只要会这几个：

已经能完成 80% 场景。

---

## 第二步

掌握：

* secrets
* env
* cache
* artifact

---

## 第三步

学习：

* Docker
* 自动部署
* Release
* matrix

---

## 第四步

进阶：

* self-hosted runner
* reusable workflow
* composite action
* monorepo CI

---

# 十五、推荐你立刻实战的项目

## 1. Vue 自动部署

```text
push main
→ npm build
→ 上传 dist
→ nginx 发布
```

---

## 2. Go 自动编译

```text
tag v1.0.0
→ build windows/linux/mac
→ 发布 release
```

---

## 3. 自动生成文档

```text
push
→ 自动生成 API 文档
```

---

## 4. 自动同步数据库备份

```text
schedule
→ sqlite dump
→ 上传云盘
```

---

# 十六、一个非常重要的认知

GitHub Actions 本质：

```text
云端 Linux 自动脚本平台
```

很多人以为它只是：

```text
CI工具
```

其实：

它几乎能自动化任何事情。

你甚至可以：

* 定时爬虫
* 自动发 Telegram
* 自动生成 AI 内容
* 自动更新网站
* 自动截图
* 自动备份服务器
* 自动运行 Go/Python 脚本

因为本质上：

> Runner 就是一台云服务器。
