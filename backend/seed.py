"""数据库初始化脚本：建表 + 写入种子数据（MySQL）。

用法（在 backend/ 目录下）：
    python seed.py            # 幂等初始化：表不存在则创建，种子缺失则补齐
    python seed.py --reset    # 执行 schema.sql 删表重建后全新初始化

种子内容：
- 3 个测试账号（test_student_1/2/3，一键切换身份联调全部功能）
- 4 个虚拟同学机器人（用于匹配兜底与自动回复）
- 集合点（昌平西山口站 / 北京化工大学）、首页公告
- 每个测试账号 2 条已完成历史行程 + 1 条已取消记录
"""
import argparse
import sys
import time
from pathlib import Path

from app.config import DATABASE_URL, BASE_DIR
from app.database import Base, SessionLocal, engine
from sqlalchemy import text
from app.models import (
    Announcement,
    Message,
    Review,
    RideGroup,
    RideRequest,
    Station,
    User,
)
from app.serializers import gen_id, member_obj

DAY = 86_400_000

BOTS = [
    ("bot_lxy", "林晓雨", "https://picsum.photos/id/177/200/200", 98),
    ("bot_cyn", "陈一诺", "https://picsum.photos/id/338/200/200", 100),
    ("bot_zzm", "周子墨", "https://picsum.photos/id/1027/200/200", 95),
    ("bot_wyc", "王宇辰", "https://picsum.photos/id/91/200/200", 97),
]

# 3 个测试账号：一键切换身份，联调全部功能
TEST_STUDENTS = [
    ("test_student_1", "测试同学A", "张艺", "https://picsum.photos/id/1011/200/200"),
    ("test_student_2", "测试同学B", "李一诺", "https://picsum.photos/id/1025/200/200"),
    ("test_student_3", "测试同学C", "王星河", "https://picsum.photos/id/1027/200/200"),
]


def seed_stations(db):
    # 坐标均为 GCJ02 火星坐标（与微信 getLocation type='gcj02' 一致）
    rows = [
        Station(
            id="metro_xishankou",
            direction="metro2school",
            name="昌平西山口站",
            type="metro",
            sort=1,
            exits=[
                {"id": "exit_a", "name": "A 口", "latitude": 40.244810, "longitude": 116.193813, "distanceToSchool": 4.5},
            ],
        ),
        Station(
            id="school_buct",
            direction="school2metro",
            name="北京化工大学（昌平校区）",
            type="school",
            sort=1,
            # 校门坐标为 GCJ02（与微信 getLocation type='gcj02' 一致），现场实测取点
            exits=[
                {"id": "gate_south", "name": "南门（正门）", "latitude": 40.247457, "longitude": 116.150646},
                {"id": "gate_east", "name": "东门", "latitude": 40.252661, "longitude": 116.154921},
                {"id": "gate_west", "name": "西门", "latitude": 40.252819, "longitude": 116.145160},
            ],
        ),
    ]
    for s in rows:
        if not db.query(Station).filter(Station.id == s.id).first():
            db.add(s)


def seed_announcements(db):
    rows = [
        ("ann_1", "安全提示", "平台不做线上强制实名：请在企业微信中自行搜索同行同学的真实姓名并对话核验；全程临时群聊沟通，勿提前私下交易。", 1),
        ("ann_2", "匹配高峰", "工作日 17:30-19:00 为返程高峰，平均 30 秒即可拼成，建议提前到岗。", 2),
    ]
    for aid, title, content, sort in rows:
        if not db.query(Announcement).filter(Announcement.id == aid).first():
            db.add(Announcement(id=aid, title=title, content=content, sort=sort))


def seed_users(db):
    now = int(time.time() * 1000)
    for openid, name, avatar, score in BOTS:
        if not db.query(User).filter(User.openid == openid).first():
            db.add(
                User(
                    openid=openid, nick_name=name, avatar=avatar, real_name=name,
                    credit_score=score, finished_count=36,
                    is_bot=True, status="normal", created_at=now,
                )
            )
    for openid, nick, real, avatar in TEST_STUDENTS:
        if not db.query(User).filter(User.openid == openid).first():
            db.add(
                User(
                    openid=openid, nick_name=nick, avatar=avatar, real_name=real,
                    credit_score=100, finished_count=2,
                    is_bot=False, status="normal", created_at=now,
                    default_wait_location="出口旁便利店门口",
                    default_outfit="黑色外套、蓝色牛仔裤",
                )
            )
    db.commit()


def seed_trips(db):
    """每个测试账号 2 条已完成行程（含 1 条已评价）+ 1 条已取消。"""
    now = int(time.time() * 1000)
    bots = {b[0]: db.query(User).filter(User.openid == b[0]).first() for b in BOTS}

    for index, (openid, nick, real, _avatar) in enumerate(TEST_STUDENTS):
        me = db.query(User).filter(User.openid == openid).first()

        # 已完成行程 1：地铁 → 学校，2 人车
        g1_id = f"seed_{openid}_g1"
        if not db.query(RideGroup).filter(RideGroup.id == g1_id).first():
            t1 = now - 2 * DAY - 20 * 3_600_000
            members1 = [member_obj(me), member_obj(bots["bot_lxy"])]
            members1[0]["nickName"] = "我"
            group1 = RideGroup(
                id=g1_id, direction="metro2school",
                station_name="昌平西山口站", exit_name="A 口",
                target_size=2, status="completed", members=members1,
                price=18, created_at=t1, completed_at=t1 + 900_000,
            )
            db.add(group1)
            db.add(RideRequest(
                id=f"seed_{openid}_r1", openid=openid, direction="metro2school",
                station_id="metro_xishankou", station_name="昌平西山口站",
                exit_id="exit_a", exit_name="A 口", target_size=2,
                price=18, wait_location="A 口", outfit="黑色外套", photo="",
                status="completed", group_id=g1_id, created_at=t1,
            ))
            db.add(Message(
                id=gen_id("msg"), group_id=g1_id, from_openid="system",
                from_name="系统通知", avatar="", type="system",
                content="拼车已完成，感谢同行！", created_at=t1 + 900_000,
            ))
            db.add(Review(
                id=gen_id("review"), group_id=g1_id, from_openid=openid,
                to_openid="bot_lxy", score=5, tags=["准时到达", "沟通顺畅"],
                comment="很顺利的一次拼车！", created_at=t1 + 3_600_000,
            ))

        # 已完成行程 2：学校 → 地铁，3 人车（未评价）
        g2_id = f"seed_{openid}_g2"
        if not db.query(RideGroup).filter(RideGroup.id == g2_id).first():
            t2 = now - 5 * DAY - 19 * 3_600_000
            members2 = [member_obj(me), member_obj(bots["bot_zzm"]), member_obj(bots["bot_wyc"])]
            members2[0]["nickName"] = "我"
            db.add(RideGroup(
                id=g2_id, direction="school2metro",
                station_name="北京化工大学（昌平校区）", exit_name="南门（正门）",
                target_size=3, status="completed", members=members2,
                price=12, created_at=t2, completed_at=t2 + 800_000,
            ))
            db.add(RideRequest(
                id=f"seed_{openid}_r2", openid=openid, direction="school2metro",
                station_id="school_buct", station_name="北京化工大学（昌平校区）",
                exit_id="gate_south", exit_name="南门（正门）", target_size=3,
                price=12, wait_location="南门", outfit="", photo="",
                status="completed", group_id=g2_id, created_at=t2,
            ))

        # 已取消：地铁 → 学校，2 人
        r3_id = f"seed_{openid}_r3"
        if not db.query(RideRequest).filter(RideRequest.id == r3_id).first():
            t3 = now - 8 * DAY - 21 * 3_600_000
            db.add(RideRequest(
                id=r3_id, openid=openid, direction="metro2school",
                station_id="metro_xishankou", station_name="昌平西山口站",
                exit_id="exit_a", exit_name="A 口", target_size=2,
                price=18, wait_location="A 口", outfit="", photo="",
                status="canceled", group_id=None, created_at=t3,
            ))
    db.commit()


def run_schema_sql():
    """执行 schema.sql 建表脚本（--reset 时通过 DROP TABLE IF EXISTS 清空并重建）。"""
    schema_path = BASE_DIR / "schema.sql"
    if not schema_path.exists():
        raise FileNotFoundError(f"未找到建表脚本: {schema_path}")
    sql_text = schema_path.read_text(encoding="utf-8")
    # 按分号拆分语句，跳过空行与纯注释
    statements = []
    for stmt in sql_text.split(";"):
        stripped = stmt.strip()
        if not stripped:
            continue
        # 去掉整行注释后的空语句
        lines = [l for l in stripped.splitlines() if not l.strip().startswith("--")]
        if any(l.strip() for l in lines):
            statements.append(stripped)
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
    print(f"[seed] 已执行 schema.sql（{len(statements)} 条语句）")


def main():
    parser = argparse.ArgumentParser(description="同路人后端数据库初始化")
    parser.add_argument("--reset", action="store_true", help="删除现有数据后全新初始化")
    args = parser.parse_args()

    if args.reset:
        # 通过 schema.sql 的 DROP TABLE IF EXISTS 清空并重建
        print("[seed] 执行 schema.sql 重建数据表 ...")
        run_schema_sql()
    else:
        # 非重置：仅创建尚不存在的表（不破坏现有数据）
        print("[seed] 创建数据表（仅建不存在的表）...")
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("[seed] 写入集合点 / 公告 ...")
        seed_stations(db)
        seed_announcements(db)
        print("[seed] 写入测试账号与虚拟同学 ...")
        seed_users(db)
        print("[seed] 写入演示历史行程 ...")
        seed_trips(db)
        db.commit()
    finally:
        db.close()

    print("\n[seed] 初始化完成 ✅")
    print("=" * 52)
    print("3 个测试账号（登录页一键登录，全部功能可用）：")
    print("  test_student_1  张艺    （测试同学A）")
    print("  test_student_2  李一诺  （测试同学B）")
    print("  test_student_3  王星河  （测试同学C）")
    print("=" * 52)
    print("数据库类型: mysql")
    print(f"连接地址: {DATABASE_URL.split('@')[-1]}")


if __name__ == "__main__":
    sys.exit(main())
