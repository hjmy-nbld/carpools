"""ORM 模型 —— 对应前端 8 类业务数据。

时间字段统一存「毫秒时间戳整数」，与前端 mock / 云函数契约一致。
"""
from sqlalchemy import BigInteger, Boolean, Column, Integer, String, Text, JSON

from .database import Base


class User(Base):
    """用户（含测试账号与虚拟同学机器人）"""
    __tablename__ = "users"

    openid = Column(String(64), primary_key=True)
    nick_name = Column(String(64), nullable=False, default="微信用户")
    avatar = Column(Text, default="")
    real_name = Column(String(32), default="")
    school = Column(String(128), default="北京化工大学（昌平校区）")
    credit_score = Column(Integer, default=100)
    status = Column(String(16), default="normal")
    default_wait_location = Column(String(128), default="")
    default_outfit = Column(String(128), default="")
    default_photo = Column(Text, default="")
    finished_count = Column(Integer, default=0)
    is_bot = Column(Boolean, default=False)
    created_at = Column(BigInteger)


class Station(Base):
    """集合点（地铁站 / 学校），exits 为出口 JSON 数组"""
    __tablename__ = "stations"

    id = Column(String(64), primary_key=True)
    direction = Column(String(32), index=True)  # metro2school / school2metro
    name = Column(String(128), nullable=False)
    type = Column(String(16), default="metro")  # metro / school
    # [{id,name,latitude,longitude,distanceToSchool}]
    exits = Column(JSON, default=list)
    sort = Column(Integer, default=0)


class Announcement(Base):
    """首页公告"""
    __tablename__ = "announcements"

    id = Column(String(64), primary_key=True)
    title = Column(String(128), nullable=False)
    content = Column(Text, default="")
    sort = Column(Integer, default=0)


class RideRequest(Base):
    """拼车请求（匹配池条目）"""
    __tablename__ = "ride_requests"

    id = Column(String(64), primary_key=True)
    openid = Column(String(64), index=True, nullable=False)
    direction = Column(String(32), nullable=False)
    station_id = Column(String(64))
    station_name = Column(String(128))
    exit_id = Column(String(64))
    exit_name = Column(String(128))
    target_size = Column(Integer, default=2)
    price = Column(Integer, default=0)
    wait_location = Column(String(128), default="")
    outfit = Column(String(128), default="")
    photo = Column(Text, default="")
    # waiting / matched / canceled / timeout / completed
    status = Column(String(16), default="waiting", index=True)
    group_id = Column(String(64), nullable=True, index=True)
    created_at = Column(BigInteger, index=True)


class RideGroup(Base):
    """拼车组，members 为成员快照 JSON 数组"""
    __tablename__ = "ride_groups"

    id = Column(String(64), primary_key=True)
    direction = Column(String(32), nullable=False)
    station_name = Column(String(128))
    exit_name = Column(String(128))
    target_size = Column(Integer, default=2)
    # active / completed / canceled
    status = Column(String(16), default="active", index=True)
    # [{openid,nickName,avatar,realName,creditScore}]
    members = Column(JSON, default=list)
    price = Column(Integer, default=0)
    created_at = Column(BigInteger)
    completed_at = Column(BigInteger, nullable=True)
    canceled_at = Column(BigInteger, nullable=True)


class Message(Base):
    """群消息：text / image / quick / system"""
    __tablename__ = "messages"

    id = Column(String(64), primary_key=True)
    group_id = Column(String(64), index=True, nullable=False)
    from_openid = Column(String(64))
    from_name = Column(String(128))
    avatar = Column(Text, default="")
    type = Column(String(16), default="text")
    content = Column(Text, default="")
    created_at = Column(BigInteger, index=True)


class Review(Base):
    """行程评价"""
    __tablename__ = "reviews"

    id = Column(String(64), primary_key=True)
    group_id = Column(String(64), index=True)
    from_openid = Column(String(64), index=True)
    to_openid = Column(String(64))
    score = Column(Integer)
    tags = Column(JSON, default=list)
    comment = Column(Text, default="")
    created_at = Column(BigInteger)


class Report(Base):
    """违规举报"""
    __tablename__ = "reports"

    id = Column(String(64), primary_key=True)
    group_id = Column(String(64), index=True)
    reporter_openid = Column(String(64), index=True)
    reported_openid = Column(String(64))
    reason = Column(String(64))
    images = Column(JSON, default=list)
    description = Column(Text, default="")
    status = Column(String(16), default="pending")
    created_at = Column(BigInteger)
