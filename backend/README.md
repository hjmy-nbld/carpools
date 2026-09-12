# 同路人 · Python 后端说明

## 启动操作手册

### 1. 首次安装（仅一次）

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
python seed.py               # 建表 + 种子数据（首次需先 CREATE DATABASE carpool）
```

### 2. 启动后端（每次开机都要做）

双击 `run.bat`，或命令行：

```bash
cd backend
python run.py
```

看到 `[OK] MySQL 连接正常` + `Uvicorn running on 0.0.0.0:8000` 即启动成功。

> MySQL 未启动时会退出并提示「服务未启动」，先在 Windows 服务中启动 MySQL（服务名通常为 `MySQL80`）。

### 3. 配置前端地址（仅网络环境变化时改）

修改 [../src/config/index.ts](../src/config/index.ts) 的 `API_BASE_URL`：

- 微信开发者工具模拟器：`http://127.0.0.1:8000`
- 手机真机调试：`http://电脑局域网IP:8000`（先 `ipconfig` 查电脑 IP，再用手机浏览器打开 `http://电脑IP:8000/docs` 验证连通）

改完执行 `npm.cmd run build:weapp` 重新编译。

### 4. 常用命令速查

| 操作 | 命令 |
|---|---|
| 启动后端 | `python run.py` |
| 重置数据 | `python seed.py --reset` |
| 接口文档 | 浏览器打开 `http://127.0.0.1:8000/docs` |
| 健康检查 | `http://127.0.0.1:8000/api/health` |
| 3 个测试账号 | 登录页点击「测试账号一键登录」或接口 `POST /api/login {"testAccount":"test1"}` |

---

校园拼车小程序的 Python 后端实现，替代/并行于微信云开发：基于 **FastAPI + SQLAlchemy + MySQL**，提供与前端 16 个云函数同名同契约的 HTTP 接口，前端切换一个配置即可从「云开发/Mock 模式」切到「Python 后端模式」。

---

## 一、技术栈

| 分类 | 选型 |
|---|---|
| Web 框架 | FastAPI（自动生成交互式接口文档 `/docs`） |
| ORM | SQLAlchemy 2.x |
| 数据库 | MySQL 8.x（本机 `127.0.0.1:3306/carpool`，驱动 pymysql） |
| 鉴权 | Bearer Token（HMAC-SHA256 签名，标准库实现，无需额外依赖） |
| 文件存储 | 本地 `uploads/` 目录，FastAPI StaticFiles 托管 |
| 服务器 | Uvicorn |

---

## 二、快速开始（Windows / macOS / Linux）

要求 Python 3.10+（本机已验证 Python 3.13）。

```bash
# 1. 进入后端目录
cd backend

# 2. （建议）创建虚拟环境
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 建表 + 写入种子数据（幂等，可重复执行）
python seed.py
# 如需清空重来：python seed.py --reset

# 5. 启动服务（二选一）
python run.py
# 或：uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# Windows 用户也可直接双击 run.bat
```

启动成功后：

- 服务地址：`http://127.0.0.1:8000`
- 健康检查：`http://127.0.0.1:8000/api/health`
- 接口文档（Swagger）：`http://127.0.0.1:8000/docs`

---

## 三、3 个测试账号与注册说明

### 注册（新用户）

平台**不做线上实名认证**：注册只需 `POST /api/login`，body：`{"realName": "张三"}`（`nickName`/`avatar` 选填），即自动建号并下发令牌。身份真实性由用户自行核验——在**企业微信中搜索对方真实姓名并发起对话**确认本校身份（登录页与群聊「企微联系」均有提示）。

### 测试账号

种子脚本预置 **3 个测试账号**，可一键切换身份使用全部功能（发起拼车、匹配、群聊、评价、举报、信用分）：

| 登录参数 | 昵称 | 姓名 | openid |
|---|---|---|---|
| `test1` | 测试同学A | 张艺 | `test_student_1` |
| `test2` | 测试同学B | 李一诺 | `test_student_2` |
| `test3` | 测试同学C | 王星河 | `test_student_3` |

- 前端在 Python 模式下，登录页会出现「**测试账号一键登录**」卡片，点击即登录。
- 接口直接调用：`POST /api/login`，body：`{"testAccount": "test1"}`，响应头 `X-Auth-Token` 即登录令牌。
- 三个账号互相之间可以真人匹配（同方向、同站点出口同时等待）；若 5 秒内没有真人，系统会安排虚拟同学兜底成团。
- 另有 4 个虚拟同学机器人（林晓雨 / 陈一诺 / 周子墨 / 王宇辰），用于匹配兜底与群聊自动回复。

---

## 四、数据库

### 生成方式

- `python seed.py` 自动执行 `Base.metadata.create_all` 建表，并幂等写入种子数据；
- ORM 表结构定义在 [app/models.py](app/models.py)，调整模型后重新执行 seed 即可（新增字段建议配合迁移工具，如 Alembic）。

### 数据表（对应原 8 个云数据库集合）

| 表名 | 说明 |
|---|---|
| `users` | 用户：openid、昵称头像、真实姓名、信用分、默认拼车信息、`is_bot` 机器人标记 |
| `stations` | 集合点：方向、名称、出口 JSON（含经纬度） |
| `announcements` | 首页公告 |
| `ride_requests` | 拼车请求：方向/集合点/报价/人数/状态/所属组 |
| `ride_groups` | 拼车组：成员快照 JSON、状态、完成/取消时间 |
| `messages` | 群消息：text/image/quick/system |
| `reviews` | 评价：评分、标签、评论 |
| `reports` | 举报：原因、图片证据、描述、处理状态 |

所有时间字段统一存**毫秒时间戳整数**，与前端契约一致。

### 数据库连接配置

后端固定使用 MySQL（驱动 `pymysql`，已在 requirements.txt 中）。连接参数均有本机开发默认值，也可通过环境变量覆盖：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `CARPOOL_MYSQL_HOST` | `127.0.0.1` | MySQL 主机 |
| `CARPOOL_MYSQL_PORT` | `3306` | 端口 |
| `CARPOOL_MYSQL_USER` | `root` | 用户名 |
| `CARPOOL_MYSQL_PASSWORD` | `123456` | 密码 |
| `CARPOOL_MYSQL_DATABASE` | `carpool` | 数据库名（需先手动创建） |

**Windows 一键启动**：直接双击 `run.bat`（或 `run-mysql.bat`，两者等价，均默认连本机 root/123456/carpool）。

**命令行方式**：

```bash
# PowerShell（默认值已是本机 root/123456，密码不同时覆盖即可）
$env:CARPOOL_MYSQL_PASSWORD='你的密码'
python seed.py            # 建表 + 种子（首次需先 CREATE DATABASE carpool）
python run.py
```

> 注意：时间戳字段在 MySQL 中使用 `BIGINT` 存储毫秒值。首次使用需先 `CREATE DATABASE carpool DEFAULT CHARACTER SET utf8mb4;` 再执行 `python seed.py`。

---

## 五、接口一览

所有业务接口均为 `POST /api/<名称>`，请求体为 JSON，鉴权接口需带请求头 `Authorization: Bearer <token>`，统一返回：

```json
{ "code": 0, "message": "ok", "data": { } }
```

| 接口 | 鉴权 | 说明 |
|---|---|---|
| `/api/login` | 否 | 注册（`{"realName":"张三"}`）/ 登录 / 切换测试账号（`{"testAccount":"test1"}`），返回用户与令牌 |
| `/api/getProfile` | 是 | 当前用户资料 |
| `/api/updateProfile` | 是 | 更新资料/默认拼车信息（body：`{"patch": {...}}`） |
| `/api/getStations` | 否 | 按方向取集合点 |
| `/api/getAnnouncements` | 否 | 首页公告 |
| `/api/createRideRequest` | 是 | 发起拼车，立即尝试真人配对 |
| `/api/getRideStatus` | 是 | 匹配轮询：真人配对 → 机器人兜底（5s/8s）→ 90s 超时 |
| `/api/cancelRideRequest` | 是 | 取消等待中的请求 |
| `/api/getChatList` | 是 | 会话列表 |
| `/api/getChatMessages` | 是 | 群消息 |
| `/api/sendMessage` | 是 | 发文字/图片/快捷语，机器人自动回复 |
| `/api/leaveGroup` | 是 | 退出拼车，信用分 -5 |
| `/api/completeRide` | 是 | 完成拼车，信用分 +1、完成次数 +1 |
| `/api/getTrips` | 是 | 行程列表（active/completed/canceled） |
| `/api/createReview` | 是 | 提交评价 |
| `/api/createReport` | 是 | 提交举报 |
| `/api/upload` | 是 | 图片上传（multipart，字段名 `file`），返回 `{url}` |
| `/api/health` | 否 | 健康检查 |

完整参数与响应结构可在启动后访问 `/docs` 在线调试。

---

## 六、匹配引擎说明

逻辑位于 [app/matching.py](app/matching.py)，由发起与轮询接口共同驱动：

1. **真人优先**：同方向 + 同集合点 + 同出口、仍在等待的请求先到先配，先发起者为组长，建组后推送系统通知与问候语；
2. **机器人兜底**：发起后 **5 秒**无真人加入，安排第 1 位虚拟同学成团；目标 3 人时，**8 秒**补第 3 人；
3. **超时**：**90 秒**仍未成团，请求置为 `timeout`；
4. 三个测试账号同时在线发起相同路线时，会优先发生真人之间的配对。

---

## 七、与前端如何对接

前端通过开关切换运行模式，见 [../src/config/index.ts](../src/config/index.ts)：

```ts
// 填入地址 = Python 后端模式；留空 '' = 云开发/Mock 双轨
export const API_BASE_URL = 'http://127.0.0.1:8000'
```

- 所有云调用经 [../src/services/cloud.ts](../src/services/cloud.ts) 统一分流：Python 模式走 HTTP + Token；微信端走 `Taro.cloud`；H5 无后端时走本地 Mock。
- 图片上传统一走 `uploadImage()`，Python 模式上传到 `/api/upload`。
- Token 保存在小程序本地存储（key：`carpool_token`）。

### 微信开发者工具联调注意

后端是 `http://127.0.0.1:8000`，开发期需在微信开发者工具中勾选：

**详情 → 本地设置 → 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**

真机/上线时需将后端部署到公网 HTTPS 域名，并在小程序管理后台配置 request 合法域名。

### H5 预览联调注意

浏览器打开 H5 预览页时，需保持本后端服务运行。如浏览器因 HTTPS 页面访问 HTTP 接口拦截了请求，可用微信开发者工具，或用支持的浏览器将 `127.0.0.1` 加入安全例外。

---

## 八、目录结构

```text
backend/
├── app/                   #后端代码
│   ├── main.py            # FastAPI 入口（CORS、异常处理、静态文件）
│   ├── config.py          # 配置（DB 路径、匹配节奏、信用分规则）
│   ├── database.py        # 引擎 / Session / Base
│   ├── models.py          # 8 张表的 ORM 模型
│   ├── security.py        # Bearer Token 签发与校验
│   ├── deps.py            # 依赖：当前用户、统一响应、业务异常
│   ├── serializers.py     # ORM → 前端 camelCase 结构
│   ├── matching.py        # 即时匹配引擎（真人配对 + 机器人兜底）
│   └── routers/api.py     # 16 个业务接口 + 上传 + 健康检查
├── uploads/               # 上传图片（自动创建）
├── schema.sql             # MySQL 建表脚本（gen_schema.py 生成，seed --reset 自动执行）
├── gen_schema.py          # 由 models.py 重新生成 schema.sql
├── seed.py                # 建表 + 种子数据脚本
├── run.py / run.bat       # 启动入口（默认 MySQL）
├── run-mysql.bat          # 同上，MySQL 一键启动
└── requirements.txt
```

---

## 九、常见问题

**Q：接口返回「未登录或登录已失效」？**
A：调 `/api/login`（注册带 `realName`，或带 `testAccount`），从响应头取 `X-Auth-Token`，之后请求都带上 `Authorization: Bearer <token>`。前端会自动处理。

**Q：想重置所有数据？**
A：`python seed.py --reset`（执行 `schema.sql` 删表重建）后全新初始化（上传的图片在 `uploads/`，不受影响）。

**Q：还需要企业微信实名认证吗？**
A：不需要。平台已移除线上实名认证，注册仅填真实姓名；身份真实性由用户自行在企业微信搜索姓名核验（登录页与群聊「企微联系」均有提示）。
