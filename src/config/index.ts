// ============================================
// 运行环境开关
// ============================================
// 填入 Python 后端地址即启用「Python 后端模式」：
//   所有 callFunction 走 HTTP 接口，登录页出现 3 个测试账号入口。
// 留空 '' 则保持原双轨：H5 走本地 mock，微信小程序走云开发。
//
// 本地联调地址：
//   微信开发者工具模拟器用 127.0.0.1；手机真机调试请改为电脑在当前网络下的 IP（手机热点也可以）
//   切换网络后务必：1) ipconfig 确认电脑 IP；2) 手机浏览器打开 http://电脑IP:8000/docs 验证连通；
//                  3) 重新编译后再点「真机调试」（「预览」模式不允许 HTTP 明文地址）
export const API_BASE_URL = 'http://10.13.27.209:8000'//手机热点联调地址
//export const API_BASE_URL = 'http://10.4.31.227:8000'//（电脑当前局域网 IP）

export const API_ENABLED = !!API_BASE_URL

/** GPS 允许半径（米）：集合点围栏，发布拼车需在该范围内（与后端校验、页面文案共用） */
export const GPS_RADIUS = 300

/** 消息页轮询间隔（毫秒） */
export const CHAT_POLL_INTERVAL = 2000

/** 匹配进度页轮询间隔（毫秒） */
export const MATCHING_POLL_INTERVAL = 1500

// ---------- 信用分规则（与后端 app/config.py 保持一致） ----------
/** 信用分上限 */
export const CREDIT_MAX_SCORE = 100
/** 警告阈值：信用分 <85 警告（功能不受限，仅提示） */
export const CREDIT_WARN_SCORE = 85
/** 冻结阈值：信用分 <75 冻结 30 天，冻结期内无法发起匹配 */
export const CREDIT_FREEZE_SCORE = 75
/** 销号阈值：信用分 <70 注销账号 */
export const CREDIT_DELETE_SCORE = 70
/** 冻结天数 */
export const CREDIT_FREEZE_DAYS = 30
export const CREDIT_FREEZE_MS = CREDIT_FREEZE_DAYS * 24 * 60 * 60 * 1000

/** 中途退出后的匹配冷却时长（毫秒）：2 分钟 */
export const LEAVE_MATCH_COOLDOWN_MS = 2 * 60 * 1000

// ---------- 信用分加分防刷（与后端 app/config.py 保持一致） ----------
/** 每个自然日最多加分次数 */
export const CREDIT_DAILY_REWARD_LIMIT = 2
/** 两次加分的最小间隔（毫秒）：3 小时 */
export const CREDIT_REWARD_MIN_INTERVAL_MS = 3 * 60 * 60 * 1000
/** 业务时区偏移（毫秒）：UTC+8，自然日按东八区 00:00 切分 */
export const BUSINESS_TZ_OFFSET_MS = 8 * 60 * 60 * 1000

/** 测试账号（与 backend/seed.py 中一致，一键切换身份联调全部功能） */
export const TEST_ACCOUNTS = [
  { key: 'test1', label: '测试同学A', realName: '张艺', desc: 'test_student_1' },
  { key: 'test2', label: '测试同学B', realName: '李一诺', desc: 'test_student_2' },
  { key: 'test3', label: '测试同学C', realName: '王星河', desc: 'test_student_3' }
]
