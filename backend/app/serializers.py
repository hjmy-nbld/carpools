"""ORM 对象 → 前端约定的 camelCase 数据结构（与 TS interfaces 严格一致）。"""
import random
import time

from .models import (
    Announcement,
    Message,
    Report,
    Review,
    RideGroup,
    RideRequest,
    Station,
    User,
)


def now_ms() -> int:
    return int(time.time() * 1000)


def gen_id(prefix: str) -> str:
    return f"{prefix}_{format(now_ms(), 'x')}_{random.randint(0, 0xFFFFF):05x}"


def user_obj(u: User) -> dict:
    return {
        "openid": u.openid,
        "nickName": u.nick_name,
        "avatar": u.avatar,
        "realName": u.real_name,
        "school": u.school,
        "creditScore": u.credit_score,
        "status": u.status,
        "frozenUntil": u.frozen_until,
        "lastLeaveAt": u.last_leave_at,
        "creditRewards": u.credit_rewards or [],
        "defaultWaitLocation": u.default_wait_location or "",
        "defaultOutfit": u.default_outfit or "",
        "defaultPhoto": u.default_photo or "",
        "finishedCount": u.finished_count or 0,
        "createTime": u.created_at,
    }


def member_obj(u: User) -> dict:
    return {
        "openid": u.openid,
        "nickName": u.nick_name,
        "avatar": u.avatar,
        "realName": u.real_name,
        "creditScore": u.credit_score,
    }


def station_obj(s: Station) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "type": s.type,
        "exits": s.exits or [],
    }


def announcement_obj(a: Announcement) -> dict:
    return {"id": a.id, "title": a.title, "content": a.content}


def request_obj(r: RideRequest) -> dict:
    return {
        "id": r.id,
        "openid": r.openid,
        "direction": r.direction,
        "stationId": r.station_id,
        "stationName": r.station_name,
        "exitId": r.exit_id,
        "exitName": r.exit_name,
        "targetSize": r.target_size,
        "price": r.price,
        "waitLocation": r.wait_location,
        "outfit": r.outfit,
        "photo": r.photo,
        "status": r.status,
        "createTime": r.created_at,
        "groupId": r.group_id,
    }


def group_obj(g: RideGroup) -> dict:
    return {
        "id": g.id,
        "direction": g.direction,
        "stationName": g.station_name,
        "exitName": g.exit_name,
        "targetSize": g.target_size,
        "status": g.status,
        "members": g.members or [],
        "price": g.price,
        "createTime": g.created_at,
        "completedAt": g.completed_at,
        "canceledAt": g.canceled_at,
    }


def message_obj(m: Message) -> dict:
    return {
        "id": m.id,
        "groupId": m.group_id,
        "fromOpenid": m.from_openid,
        "fromName": m.from_name,
        "avatar": m.avatar or "",
        "type": m.type,
        "content": m.content,
        "createTime": m.created_at,
    }


def review_obj(v: Review) -> dict:
    return {
        "id": v.id,
        "groupId": v.group_id,
        "fromOpenid": v.from_openid,
        "toOpenid": v.to_openid,
        "score": v.score,
        "tags": v.tags or [],
        "comment": v.comment,
        "createTime": v.created_at,
    }


def report_obj(r: Report) -> dict:
    return {
        "id": r.id,
        "groupId": r.group_id,
        "reporterOpenid": r.reporter_openid,
        "reportedOpenid": r.reported_openid,
        "reason": r.reason,
        "images": r.images or [],
        "description": r.description,
        "status": r.status,
        "createTime": r.created_at,
    }


def session_obj(g: RideGroup, messages: list[Message]) -> dict:
    visible = [m for m in messages if m.type != "system"]
    last = visible[-1] if visible else None
    return {
        "groupId": g.id,
        "direction": g.direction,
        "stationName": g.station_name,
        "exitName": g.exit_name,
        "targetSize": g.target_size,
        "memberCount": len(g.members or []),
        "members": g.members or [],
        "status": g.status,
        "lastMessage": (
            ("[图片]" if last.type == "image" else last.content)
            if last
            else "拼车小组已建立，来打个招呼吧"
        ),
        "lastTime": last.created_at if last else g.created_at,
        "unread": 0,
    }
