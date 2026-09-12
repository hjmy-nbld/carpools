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
CREDIT_MAX = 120

# 服务端口（仅文档/脚本引用）
SERVER_PORT = int(os.environ.get("CARPOOL_PORT", "8000"))
