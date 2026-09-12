"""本地启动入口：python run.py

启动前先对 MySQL 做连通性自检，失败时按错误码给出清晰的中文提示并退出，
避免"服务已启动但首个请求才报数据库错误"的隐性问题。
"""
import sys

from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import DATABASE_URL, MYSQL_DATABASE, SERVER_PORT
from app.database import engine


def check_database() -> None:
    """连接 MySQL 自检：区分服务未启动 / 认证失败 / 数据库不存在三类常见问题。"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[OK] MySQL 连接正常")
    except OperationalError as e:
        code = e.orig.args[0] if e.orig and e.orig.args else None
        if code == 2003:
            print(
                f"[FAIL] 无法连接 MySQL（{DATABASE_URL.split('@')[-1].split('?')[0]}）。\n"
                "       MySQL 服务未启动：请在 Windows 服务中启动 MySQL（服务名通常为 MySQL80），\n"
                "       或运行：net start mysql80"
            )
        elif code == 1045:
            print(
                "[FAIL] MySQL 认证失败（错误 1045）：账号或密码不正确。\n"
                "       可通过环境变量 CARPOOL_MYSQL_USER / CARPOOL_MYSQL_PASSWORD 覆盖默认配置。"
            )
        elif code == 1049:
            print(
                f"[FAIL] 数据库 {MYSQL_DATABASE} 不存在（错误 1049）。\n"
                f"       请先执行：CREATE DATABASE {MYSQL_DATABASE} CHARACTER SET utf8mb4;"
            )
        else:
            print(f"[FAIL] MySQL 连接失败（错误码 {code}）：{e.orig if e.orig else e}")
        sys.exit(1)


if __name__ == "__main__":
    check_database()

    import uvicorn

    # 监听 0.0.0.0：开发者工具模拟器用 127.0.0.1，真机预览用电脑局域网 IP 均可访问
    uvicorn.run("app.main:app", host="0.0.0.0", port=SERVER_PORT, reload=False)
