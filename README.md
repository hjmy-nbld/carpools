# 同路人 · 校园拼车即时匹配小程序

面向高校学生的**固定路线即时拼车**微信小程序：在「地铁站 ↔ 学校」之间，学生到达集合点后一键发起拼车，系统在同方向、同集合点的同学之间即时匹配，自动建立临时群聊沟通集合细节，行程结束后互评积累信用分。注册仅需填写真实姓名，身份真实性由同学在企业微信中自行搜索核验。

> 核心场景：出地铁站回学校 / 出校门赶地铁 · GPS 200 米围栏验证 · 真实姓名 + 企业微信自行核验 · 2～3 人即时成团

- **前端**：Taro 4.1.9 + React 18 + TypeScript 5 + Sass/CSS Modules（编译为微信小程序，也可 H5 预览）
- **后端**：FastAPI + SQLAlchemy 2 + **MySQL 8**（Python 3.13，Bearer Token 鉴权）
- **双数据通道**：配置一个后端地址即走真实接口；留空则 H5 端使用内置 Mock（零后端可演示全流程）

---

## 一、功能流程

```text
注册/登录（头像昵称选填，仅需真实姓名）
   └─ 平台不做线上实名认证 —— 请自行在企业微信搜索同学姓名并对话核验
        └─ 选择出行方向（地铁→学校 / 学校→地铁）与集合点（地铁口/校门）
             └─ GPS 200 米围栏验证（小程序真机为真实定位，H5 为模拟通过）
                  └─ 填写拼车信息（报价、等候位置、着装描述、辨认照片，可存为默认）
                       └─ 选择人数（2 人 / 3 人）→ 进入匹配池
                            └─ 匹配成功 → 临时群聊（文字 / 图片 / 快捷语 / 系统通知）
                                 ├─ 完成拼车 → 五星 + 标签 + 文字评价（信用分 +1）
                                 ├─ 举报违规（原因 + 图片证据，后台待处理）
                                 └─ 中途退出 → 二次确认，扣信用分 5 分
```

**匹配规则**：真人优先（同方向 + 同站点出口，先发起者为组长）→ 无真人时机器人 5 秒兜底入团（3 人车第 8 秒补第二人）→ 90 秒未成团自动超时取消。

**信用机制**：初始 100 分，完成行程 +1，恶意退出 −5，区间 0～120。

**当前集合点（GCJ02 坐标）**：昌平西山口站 A 口（地铁→学校）；北京化工大学昌平校区 南门 / 东门 / 西门（学校→地铁）。

---

## 二、快速开始

### 1. 启动后端（FastAPI + MySQL）

前置：已安装 MySQL 8，root 密码 `123456`（不同则改 `backend/app/config.py` 默认值或设环境变量 `CARPOOL_MYSQL_PASSWORD`）。

```powershell
# 首次：建库
mysql -u root -p123456 -e "CREATE DATABASE IF NOT EXISTS carpool DEFAULT CHARACTER SET utf8mb4;"

# 初始化 Python 虚拟环境并安装依赖（已装好可跳过）
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt

# 建表 + 写入种子数据（3 测试账号 / 机器人 / 站点 / 公告 / 历史行程）
.\.venv\Scripts\python seed.py

# 启动（双击 run.bat 等价）
.\.venv\Scripts\python run.py
```

启动后：接口服务 `http://127.0.0.1:8000`，Swagger 文档 `http://127.0.0.1:8000/docs`。
重置全部数据：`python seed.py --reset`（执行 `schema.sql` 删表重建）。

### 2. 构建并运行前端

本仓库依赖已安装。Node 便携版路径（本机未加入 PATH）：`C:\Users\daoyou\.local\nodejs\node.exe`。

```powershell
# 微信小程序（产物输出到 dist-weapp/，与 H5 的 dist/ 隔离）
$env:TARO_OUTPUT_DIR='dist-weapp'
npm run build:weapp          # 一次性构建；持续监听用 npm run dev:weapp

# H5 预览（产物 dist/，走内置 Mock，无需后端）
npm run dev:h5
```

### 3. 微信开发者工具

1. 导入项目根目录 `e:\carpools`（AppID `wxd443dc3d7874b7a8`，`project.config.json` 已指向 `dist-weapp/`）。
2. 详情 → 本地设置 → 勾选「不校验合法域名、web-view、TLS 以及 HTTPS 证书」（`urlCheck:false` 已写入配置）。
3. 每次重新构建后点「编译」。后端地址配置在 [src/config/index.ts](src/config/index.ts)：
   - 模拟器调试：`http://127.0.0.1:8000`
   - 真机调试：改为电脑局域网 IP，如 `http://10.13.27.209:8000`（手机与电脑同一 Wi-Fi；换网后 IP 会变），并放行防火墙 8000 端口，然后用工具栏「**真机调试**」推送（预览包会拦截 HTTP 局域网请求）。

### 4. 测试账号（免填写姓名，已带信用分与历史行程）

登录页「测试账号一键登录」卡片直接点选；接口方式 `POST /api/login`，body `{"testAccount":"test1"}`。

| 参数 | 昵称 | 真实姓名 |
|---|---|---|
| `test1` | 测试同学A | 张艺 |
| `test2` | 测试同学B | 李一诺 |
| `test3` | 测试同学C | 王星河 |

新用户走正常注册：`{"realName":"张三"}`（头像昵称为选填）。

---

## 三、目录结构（含每个文件说明）

```text
carpools/
├── src/                              # 前端源码（Taro + React + TS）
│   ├── app.tsx                       # 小程序入口组件，挂载全局样式
│   ├── app.config.ts                 # 全局配置：11 个页面路由、4 个 tabBar、定位权限
│   ├── app.scss                      # 全局样式入口（兼容层 + 主题 + reset）
│   ├── index.html                    # H5 构建的 HTML 模板
│   ├── config/
│   │   └── index.ts                  # 运行环境开关：API_BASE_URL、测试账号清单
│   ├── services/
│   │   └── cloud.ts                  # 统一服务层：callFunction/uploadImage/token（HTTP 或 H5 Mock）
│   ├── store/
│   │   └── useUserStore.ts           # 全局用户状态（zustand + 本地缓存 + 启动初始化）
│   ├── types/
│   │   └── index.ts                  # 前后端共享的全部业务 TS 类型
│   ├── utils/
│   │   ├── format.ts                 # 时间/时长等展示格式化
│   │   └── location.ts               # GCJ02 定位 + Haversine 200 米围栏距离校验
│   ├── styles/
│   │   ├── variables.scss            # 设计变量：颜色/字号/间距/圆角/阴影/mixin
│   │   ├── theme.scss                # 语义化主题类（按钮、卡片、徽章等）
│   │   └── compat.scss               # H5/小程序跨端样式兼容层
│   ├── components/                   # 通用组件（tsx + module.scss）
│   │   ├── Empty/                    # 空状态占位（图标 + 文案）
│   │   ├── RouteTag/                 # 进校/离校方向彩色徽章
│   │   └── SectionCard/              # 卡片容器（标题 + 内容插槽）
│   ├── data/                         # H5 Mock 模式的本地接口实现（与后端接口同名）
│   │   ├── _store.ts                 # 内存数据库：种子数据 + localStorage 持久化 + 配对工具
│   │   ├── login.ts                  # Mock 登录（首次建默认用户）
│   │   ├── getProfile.ts             # 取/补建当前用户资料
│   │   ├── updateProfile.ts          # 资料浅合并更新
│   │   ├── getStations.ts            # 按方向返回站点与出口
│   │   ├── getAnnouncements.ts       # 返回首页公告
│   │   ├── createRideRequest.ts      # 建拼车请求并登记模拟匹配计划
│   │   ├── getRideStatus.ts          # 匹配状态流转（成团/补人/90 秒超时）
│   │   ├── cancelRideRequest.ts      # 取消等待中的请求
│   │   ├── getChatList.ts            # 汇总会话列表
│   │   ├── getChatMessages.ts        # 取群消息（升序）
│   │   ├── sendMessage.ts            # 发消息 + 模拟自动回复
│   │   ├── leaveGroup.ts             # 退组并扣信用分 5
│   │   ├── completeRide.ts           # 完成行程、完成数+1、信用分+1
│   │   ├── createReview.ts           # 提交评价
│   │   ├── createReport.ts           # 提交举报
│   │   └── getTrips.ts               # 进行中/历史行程列表
│   ├── assets/
│   │   └── tabbar/*.png              # tabBar 图标（小程序仅支持 png/jpg，8 个）
│   └── pages/                        # 11 个页面，每页三件套（index.tsx 逻辑 / .config.ts 页面配置 / .module.scss 样式）
│       ├── home/                     # 首页：公告轮播、进行中行程卡片、进校/离校双入口
│       ├── publish/                  # 发起拼车：选站点出口/人数/价格、GPS 校验、辨认信息与照片
│       ├── matching/                 # 匹配等待：轮询状态、成团跳群聊、超时处理
│       ├── chat/                     # 消息（tabBar）：群聊会话列表
│       ├── chat-detail/              # 群聊详情：四类消息、快捷语、企微核验提示、完成/退出/举报
│       ├── trips/                    # 行程（tabBar）：进行中与历史行程
│       ├── review/                   # 行程评价：星级 + 动态标签 + 文字
│       ├── report/                   # 违规举报：原因 + 证据图 + 描述
│       ├── default-info/             # 默认辨认信息：常用等候位/着装/照片
│       ├── mine/                     # 我的（tabBar）：信用分、完成次数、资料入口
│       └── login/                    # 登录/注册：真实姓名注册 + 3 个测试账号一键登录
│
├── backend/                          # Python 后端（FastAPI + SQLAlchemy + MySQL），详见 backend/README.md
│   ├── run.py                        # uvicorn 启动入口（0.0.0.0:8000）
│   ├── run.bat / run-mysql.bat       # Windows 一键启动（两者等价，默认连本机 MySQL）
│   ├── seed.py                       # 建表 + 种子数据（--reset 用 schema.sql 重建）
│   ├── schema.sql                    # MySQL 建表 DDL（8 表 + 索引，时间用 BIGINT 毫秒）
│   ├── gen_schema.py                 # 由 ORM 模型重新生成 schema.sql 的工具
│   ├── requirements.txt              # Python 依赖清单
│   ├── uploads/                      # 图片上传目录（辨认照片/聊天图/举报证据，自动创建）
│   └── app/
│       ├── main.py                   # FastAPI 应用：CORS、异常处理、/uploads 静态托管、路由注册
│       ├── config.py                 # 全局配置：MySQL 连接（可环境变量覆盖）、匹配节奏、信用规则
│       ├── database.py               # 引擎/会话（连接池 pre_ping）、get_db 依赖
│       ├── models.py                 # 8 张表的 ORM 模型
│       ├── serializers.py            # ORM → 前端 camelCase 结构转换
│       ├── security.py               # Bearer Token 签发/校验（标准库 HMAC-SHA256）
│       ├── deps.py                   # 统一响应 ok()、ApiError、current_user 鉴权依赖
│       ├── matching.py               # 即时匹配引擎：真人优先 + 机器人兜底 + 超时 + 自动回复
│       └── routers/
│           └── api.py                # 16 个 POST /api/<name> 业务接口 + /api/upload + /api/health
│
├── types/global.d.ts                 # 全局 TS 声明（defineAppConfig 等编译辅助）
├── config/                           # Taro 构建配置
│   ├── index.ts                      # 公共配置：输出目录(TARO_OUTPUT_DIR)、webpack '@' 别名、CSS Modules
│   ├── dev.ts                        # 开发环境覆盖项
│   └── prod.ts                       # 生产环境覆盖项
├── babel.config.js                   # Babel 配置（babel-preset-taro）
├── .eslintrc.js                      # ESLint 规则（Taro + React Hooks）
├── tsconfig.json                     # TypeScript 配置（@ 路径别名 → src）
├── sitemap.json                      # 小程序搜索收录配置
├── project.config.json               # 微信开发者工具项目配置（miniprogramRoot=dist-weapp，关闭域名校验）
├── project.private.config.json       # 开发者工具本机私有配置（不入版本规范）
├── package.json / package-lock.json  # 前端依赖与构建脚本（锁定 Taro 4.1.9）
├── 校园拼车即时匹配.docx              # 需求规格说明书
└── README.md                         # 本文件
```

> `node_modules/`（前端依赖）、`backend/.venv/`（Python 虚拟环境）、`dist-weapp/`（小程序构建产物）、`.swc/`（构建缓存）均为安装/构建时自动生成，不纳入手工维护。

---

## 四、接口一览（均为 POST，信封 `{code,message,data}`）

`login` · `getProfile` · `updateProfile` · `getStations` · `getAnnouncements` · `createRideRequest` · `getRideStatus` · `cancelRideRequest` · `getChatList` · `getChatMessages` · `sendMessage` · `leaveGroup` · `completeRide` · `createReview` · `createReport` · `getTrips`，另有 `POST /api/upload`（图片，字段名 `file`）与 `GET /api/health`。完整字段见 [backend/README.md](backend/README.md)。

鉴权：登录响应头 `X-Auth-Token` 下发令牌，前端存于 `carpool_token`，后续请求带 `Authorization: Bearer <token>`。

---

## 五、常用维护命令

```powershell
# 重置数据库（清空行程/消息/用户后重建种子）
cd backend; .\.venv\Scripts\python seed.py --reset

# 端口 8000 被占用时（WinError 10048）
Get-NetTCPConnection -LocalPort 8000 -State Listen | Stop-Process -Id { $_.OwningProcess }

# 真机调试放行防火墙（管理员 PowerShell）
New-NetFirewallRule -DisplayName "carpool-8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Any
```

## 六、已知边界（当前版本未实现）

WebSocket 实时推送（现用轮询）、真实微信 `wx.login` 换 openid、GPS 服务端复核（目前仅前端 200 米校验）、管理员后台（举报仅落库待处理）、预约拼车/等待时间预测。
