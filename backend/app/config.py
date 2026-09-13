"""全局配置：所有路径均相对于 backend/ 目录。"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ---------- 数据库配置（固定 MySQL） ----------
# 连接参数均可通过环境变量覆盖，默认值为本机开发环境：
#   CARPOOL_MYSQL_HOST     默认 127.0.0.1
#   CARPOOL_MYSQL_PORT     默认 3306
#   CARPOOL_MYSQL_USER     默认 root
#   CARPOOL_MYSQL_PASSWORD 默认 123456
#   CARPOOL_MYSQL_DATABASE 默认 carpool
MYSQL_HOST = os.environ.get("CARPOOL_MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.environ.get("CARPOOL_MYSQL_PORT", "3306"))
MYSQL_USER = os.environ.get("CARPOOL_MYSQL_USER", "root")
MYSQL_PASSWORD = os.environ.get("CARPOOL_MYSQL_PASSWORD", "123456")
MYSQL_DATABASE = os.environ.get("CARPOOL_MYSQL_DATABASE", "carpool")
DATABASE_URL = (
    f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
    f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4"
)

# 上传文件目录（辨认照片 / 聊天图片 / 举报证据）
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Token 签名密钥（本地演示用；生产环境请通过环境变量覆盖）
TOKEN_SECRET = os.environ.get("CARPOOL_TOKEN_SECRET", "carpool-local-dev-secret-2026")

# 匹配节奏（秒）：5 秒后第 2 人（虚拟同学兜底），8 秒后第 3 人；90 秒超时
BOT_SECOND_JOIN_SECONDS = 5
BOT_THIRD_JOIN_SECONDS = 8
WAIT_TIMEOUT_SECONDS = 90

# 信用分规则
LEAVE_CREDIT_PENALTY = 5
COMPLETE_CREDIT_REWARD = 1
CREDIT_MIN = 0
CREDIT_MAX = 100
# 联动处置阈值（严格小于触发）：
#   <85 警告（仅提示，功能正常）；<75 冻结 30 天（冻结期内无法发起匹配）；<70 销号
CREDIT_WARN_SCORE = 85
CREDIT_FREEZE_SCORE = 75
CREDIT_DELETE_SCORE = 70
FREEZE_DAYS = 30

# 中途退出（匹配成功后 leaveGroup）后的匹配冷却时间（秒）
LEAVE_MATCH_COOLDOWN_SECONDS = 120

# 信用分加分防刷（完成行程 +1 时校验）：
#   每个自然日（UTC+8）最多加 2 次，且第 2 次距第 1 次至少间隔 3 小时
CREDIT_DAILY_REWARD_LIMIT = 2
CREDIT_REWARD_MIN_INTERVAL_SECONDS = 3 * 60 * 60
# 业务时区（东八区）：自然日按 UTC+8 的 00:00 切分，避免部署机时区漂移
BUSINESS_TZ_OFFSET_MS = 8 * 60 * 60 * 1000

# 服务端口（仅文档/脚本引用）
SERVER_PORT = int(os.environ.get("CARPOOL_PORT", "8000"))
