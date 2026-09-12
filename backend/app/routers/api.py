"""全部业务接口 —— 路径 /api/<云函数名>，入参/出参与前端 16 个 mock 完全对齐。

统一返回信封：{"code": 0, "message": "ok", "data": ...}
"""
import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from sqlalchemy.orm import Session

from ..config import (
    COMPLETE_CREDIT_REWARD,
    CREDIT_MAX,
    CREDIT_MIN,
    LEAVE_CREDIT_PENALTY,
    UPLOAD_DIR,
)
from ..database import get_db
from ..deps import ApiError, current_user, ok, require_user
from ..matching import _find_human_peer, form_group, try_match
from ..models import (
    Announcement,
    Message,
    Report,
    Review,
    RideGroup,
    RideRequest,
    Station,
    User,
)
from ..serializers import (
    announcement_obj,
    gen_id,
    group_obj,
    member_obj,
    message_obj,
    now_ms,
    request_obj,
    review_obj,
    session_obj,
    station_obj,
    user_obj,
)
from ..security import create_token

router = APIRouter(prefix="/api")

# 测试账号别名 → openid
TEST_ACCOUNT_MAP = {
    "test1": "test_student_1",
    "test2": "test_student_2",
    "test3": "test_student_3",
    "test_student_1": "test_student_1",
    "test_student_2": "test_student_2",
    "test_student_3": "test_student_3",
}

PEER_REPLIES = [
    "好嘞，我就在出口这边等你～",
    "收到，稍等我两分钟",
    "我穿黑色外套，背深色书包",
    "看到你了！我挥手示意",
    "可以的，我们就在这个位置上车",
    "我大概 3 分钟到，麻烦稍等一下",
]


# ---------------- 工具 ----------------

def is_member(group: RideGroup, openid: str) -> bool:
    return any(m.get("openid") == openid for m in (group.members or []))


def map_trip_status(req_status: str, group_status: str | None) -> str:
    if req_status == "waiting":
        return "waiting"
    if req_status == "matched":
        return group_status or "active"
    if req_status == "completed":
        return "completed"
    return "canceled"


# ---------------- 账号 / 资料 ----------------

@router.post("/login")
def login(
    response: Response,
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(current_user),
):
    """登录 / 注册：带 token 返回当前账号；带 testAccount 切换测试账号；
    未登录时仅凭 realName 即可注册新账号（身份真实性由同学在企业微信中自行核验）。"""
    event = event or {}
    target = user

    test_key = str(event.get("testAccount") or "").strip()
    if test_key:
        openid = TEST_ACCOUNT_MAP.get(test_key)
        if not openid:
            raise ApiError("测试账号不存在")
        target = db.query(User).filter(User.openid == openid).first()
        if target is None:
            raise ApiError("测试账号未初始化，请先运行 python seed.py")

    if target is None:
        # 注册：只要求填写真实姓名
        real_name = str(event.get("realName") or "").strip()
        if not real_name:
            raise ApiError("请先填写真实姓名", http_status=401)
        target = User(
            openid=gen_id("u"),
            nick_name=str(event.get("nickName") or "").strip() or real_name,
            avatar=str(event.get("avatar") or "").strip()
            or "https://picsum.photos/id/64/200/200",
            real_name=real_name,
            created_at=now_ms(),
        )
        db.add(target)
        db.commit()
        db.refresh(target)
    else:
        # 已有账号：允许顺带更新姓名 / 昵称 / 头像
        real_name = str(event.get("realName") or "").strip()
        if real_name:
            target.real_name = real_name
        nick_name = str(event.get("nickName") or "").strip()
        if nick_name:
            target.nick_name = nick_name
        avatar = str(event.get("avatar") or "").strip()
        if avatar:
            target.avatar = avatar
        db.commit()
        db.refresh(target)

    response.headers["X-Auth-Token"] = create_token(target.openid)
    return ok(user_obj(target))


@router.post("/getProfile")
def get_profile(user: User = Depends(require_user)):
    return ok(user_obj(user))


PROFILE_PATCH_FIELDS = {
    "nickName": "nick_name",
    "avatar": "avatar",
    "realName": "real_name",
    "school": "school",
    "defaultWaitLocation": "default_wait_location",
    "defaultOutfit": "default_outfit",
    "defaultPhoto": "default_photo",
}


@router.post("/updateProfile")
def update_profile(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    patch = (event or {}).get("patch") or {}
    for js_key, col in PROFILE_PATCH_FIELDS.items():
        if js_key in patch and patch[js_key] is not None:
            setattr(user, col, patch[js_key])
    db.commit()
    db.refresh(user)
    return ok(user_obj(user))


# ---------------- 基础数据 ----------------

@router.post("/getStations")
def get_stations(event: dict | None = None, db: Session = Depends(get_db)):
    direction = (event or {}).get("direction") or "metro2school"
    rows = (
        db.query(Station)
        .filter(Station.direction == direction)
        .order_by(Station.sort.asc())
        .all()
    )
    return ok([station_obj(s) for s in rows])


@router.post("/getAnnouncements")
def get_announcements(db: Session = Depends(get_db)):
    rows = db.query(Announcement).order_by(Announcement.sort.asc()).all()
    return ok([announcement_obj(a) for a in rows])


# ---------------- 拼车请求 / 匹配 ----------------

@router.post("/createRideRequest")
def create_ride_request(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    event = event or {}
    now = now_ms()
    req = RideRequest(
        id=gen_id("req"),
        openid=user.openid,
        direction=event.get("direction"),
        station_id=event.get("stationId"),
        station_name=event.get("stationName"),
        exit_id=event.get("exitId"),
        exit_name=event.get("exitName"),
        target_size=int(event.get("targetSize") or 2),
        price=int(float(event.get("price") or 0)),
        wait_location=event.get("waitLocation") or "",
        outfit=event.get("outfit") or "",
        photo=event.get("photo") or "",
        status="waiting",
        created_at=now,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # 立即尝试与等待中的真人配对（先到者为组长）
    peer_req = _find_human_peer(db, req)
    if peer_req is not None:
        peer_user = db.query(User).filter(User.openid == peer_req.openid).first()
        form_group(db, peer_req, req, peer_user, user, now)
        db.refresh(req)

    return ok(request_obj(req))


@router.post("/getRideStatus")
def get_ride_status(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    request_id = (event or {}).get("requestId")
    req = db.query(RideRequest).filter(RideRequest.id == request_id).first()
    if req is None or req.openid != user.openid:
        raise ApiError("拼车请求不存在")

    now = now_ms()
    elapsed = max(0, (now - req.created_at) // 1000)
    base = {"elapsed": elapsed, "estimated": 30, "targetSize": req.target_size}

    if req.status == "canceled":
        return ok({**base, "status": "canceled", "joinedCount": 1})

    if req.status == "timeout":
        return ok({**base, "status": "timeout", "joinedCount": 1})

    if req.status == "matched" or req.status == "waiting":
        group = try_match(db, req, now)
        db.refresh(req)
        if req.status == "timeout":
            return ok({**base, "status": "timeout", "joinedCount": 1})
        if group is not None:
            return ok(
                {
                    **base,
                    "status": "matched",
                    "elapsed": max(0, (now - req.created_at) // 1000),
                    "joinedCount": len(group.members or []),
                    "group": group_obj(group),
                }
            )

    return ok({**base, "status": "waiting", "joinedCount": 1})


@router.post("/cancelRideRequest")
def cancel_ride_request(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    request_id = (event or {}).get("requestId")
    req = db.query(RideRequest).filter(RideRequest.id == request_id).first()
    if req is None or req.openid != user.openid:
        raise ApiError("拼车请求不存在")
    if req.status == "waiting":
        req.status = "canceled"
        db.commit()
    return ok({"canceled": True})


# ---------------- 群聊 ----------------

@router.post("/getChatList")
def get_chat_list(
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    groups = (
        db.query(RideGroup)
        .order_by(RideGroup.created_at.desc())
        .all()
    )
    result = []
    for g in groups:
        if not is_member(g, user.openid):
            continue
        msgs = (
            db.query(Message)
            .filter(Message.group_id == g.id)
            .order_by(Message.created_at.asc())
            .all()
        )
        result.append(session_obj(g, msgs))
    result.sort(key=lambda s: s["lastTime"], reverse=True)
    return ok(result)


@router.post("/getChatMessages")
def get_chat_messages(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    group_id = (event or {}).get("groupId")
    group = db.query(RideGroup).filter(RideGroup.id == group_id).first()
    if group is None or not is_member(group, user.openid):
        raise ApiError("拼车组不存在")
    msgs = (
        db.query(Message)
        .filter(Message.group_id == group_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return ok([message_obj(m) for m in msgs])


@router.post("/sendMessage")
def send_message(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    event = event or {}
    group_id = event.get("groupId")
    msg_type = event.get("type") or "text"
    content = str(event.get("content") or "").strip()
    if not content:
        raise ApiError("消息内容不能为空")

    group = db.query(RideGroup).filter(RideGroup.id == group_id).first()
    if group is None or not is_member(group, user.openid):
        raise ApiError("拼车组不存在")

    now = now_ms()
    msg = Message(
        id=gen_id("msg"),
        group_id=group_id,
        from_openid=user.openid,
        from_name="我",
        avatar=user.avatar,
        type=msg_type,
        content=content,
        created_at=now,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    # 虚拟同学自动回复（组内第一个机器人成员；真人之间不介入）
    if group.status == "active":
        bot_member = next(
            (m for m in (group.members or []) if str(m.get("openid", "")).startswith("bot_")),
            None,
        )
        if bot_member is not None:
            count = db.query(Message).filter(Message.group_id == group_id).count()
            reply_text = (
                "收到图片了，我马上过来！"
                if msg_type == "image"
                else PEER_REPLIES[count % len(PEER_REPLIES)]
            )
            db.add(
                Message(
                    id=gen_id("msg"),
                    group_id=group_id,
                    from_openid=bot_member["openid"],
                    from_name=bot_member.get("nickName", "同行同学"),
                    avatar=bot_member.get("avatar", ""),
                    type="text",
                    content=reply_text,
                    created_at=now + 300,
                )
            )
            db.commit()

    return ok(message_obj(msg))


@router.post("/leaveGroup")
def leave_group(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    group_id = (event or {}).get("groupId")
    group = db.query(RideGroup).filter(RideGroup.id == group_id).first()
    if group is None or not is_member(group, user.openid):
        raise ApiError("拼车组不存在")

    now = now_ms()
    group.status = "canceled"
    group.canceled_at = now
    req = (
        db.query(RideRequest)
        .filter(RideRequest.group_id == group_id, RideRequest.openid == user.openid)
        .first()
    )
    if req is not None:
        req.status = "canceled"

    user.credit_score = max(CREDIT_MIN, user.credit_score - LEAVE_CREDIT_PENALTY)
    db.add(
        Message(
            id=gen_id("msg"),
            group_id=group_id,
            from_openid="system",
            from_name="系统通知",
            avatar="",
            type="system",
            content=f"你已退出本次拼车，临时聊天将关闭，信用分 -{LEAVE_CREDIT_PENALTY}。",
            created_at=now,
        )
    )
    db.commit()
    db.refresh(group)
    return ok(
        {
            "group": group_obj(group),
            "creditScore": user.credit_score,
            "creditDelta": -LEAVE_CREDIT_PENALTY,
        }
    )


@router.post("/completeRide")
def complete_ride(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    group_id = (event or {}).get("groupId")
    group = db.query(RideGroup).filter(RideGroup.id == group_id).first()
    if group is None or not is_member(group, user.openid):
        raise ApiError("拼车组不存在")

    now = now_ms()
    group.status = "completed"
    group.completed_at = now
    req = (
        db.query(RideRequest)
        .filter(RideRequest.group_id == group_id, RideRequest.openid == user.openid)
        .first()
    )
    if req is not None:
        req.status = "completed"

    user.finished_count = (user.finished_count or 0) + 1
    user.credit_score = min(CREDIT_MAX, user.credit_score + COMPLETE_CREDIT_REWARD)
    db.add(
        Message(
            id=gen_id("msg"),
            group_id=group_id,
            from_openid="system",
            from_name="系统通知",
            avatar="",
            type="system",
            content="拼车已完成，感谢同行！别忘了给同行的同学做个评价～",
            created_at=now,
        )
    )
    db.commit()
    db.refresh(group)
    return ok({"group": group_obj(group)})


# ---------------- 行程 / 评价 / 举报 ----------------

@router.post("/getTrips")
def get_trips(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    tab = (event or {}).get("tab") or "active"
    reqs = (
        db.query(RideRequest)
        .filter(RideRequest.openid == user.openid)
        .order_by(RideRequest.created_at.desc())
        .all()
    )
    records = []
    self_member = member_obj(user)
    self_member["nickName"] = "我"

    for req in reqs:
        group = db.query(RideGroup).filter(RideGroup.id == req.group_id).first() if req.group_id else None
        status = map_trip_status(req.status, group.status if group else None)
        reviewed = False
        if group is not None:
            reviewed = (
                db.query(Review)
                .filter(Review.group_id == group.id, Review.from_openid == user.openid)
                .first()
                is not None
            )
        records.append(
            {
                "id": req.id,
                "groupId": req.group_id,
                "requestId": req.id,
                "direction": req.direction,
                "stationName": req.station_name,
                "exitName": req.exit_name,
                "targetSize": req.target_size,
                "status": status,
                "price": req.price,
                "createTime": req.created_at,
                "members": group.members if group else [self_member],
                "reviewed": reviewed,
            }
        )

    records.sort(key=lambda r: r["createTime"], reverse=True)
    if tab == "active":
        records = [r for r in records if r["status"] in ("waiting", "active")]
    else:
        records = [r for r in records if r["status"] == tab]
    return ok(records)


@router.post("/createReview")
def create_review(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    event = event or {}
    review = Review(
        id=gen_id("review"),
        group_id=event.get("groupId"),
        from_openid=user.openid,
        to_openid=event.get("toOpenid"),
        score=int(event.get("score") or 5),
        tags=event.get("tags") or [],
        comment=event.get("comment") or "",
        created_at=now_ms(),
    )
    db.add(review)
    db.commit()
    return ok({"success": True})


@router.post("/createReport")
def create_report(
    event: dict | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    event = event or {}
    report = Report(
        id=gen_id("report"),
        group_id=event.get("groupId"),
        reporter_openid=user.openid,
        reported_openid=event.get("reportedOpenid"),
        reason=event.get("reason"),
        images=event.get("images") or [],
        description=event.get("description") or "",
        status="pending",
        created_at=now_ms(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ok({"success": True, "id": report.id})


# ---------------- 文件上传 ----------------

UPLOAD_MAX_BYTES = 10 * 1024 * 1024  # 单文件上限 10MB


@router.post("/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(require_user),
):
    suffix = os.path.splitext(file.filename or "")[1].lower()
    if suffix not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        suffix = ".jpg"
    save_name = f"{uuid.uuid4().hex}{suffix}"
    save_path = UPLOAD_DIR / save_name

    # 分块写入并累计校验大小，防止超大文件占满内存
    size = 0
    try:
        with open(save_path, "wb") as f:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > UPLOAD_MAX_BYTES:
                    raise ApiError("图片超过 10MB，请压缩后再上传", http_status=413)
                f.write(chunk)
    except ApiError:
        save_path.unlink(missing_ok=True)  # 超限时删除半成品文件
        raise
    finally:
        await file.close()

    base = str(request.base_url).rstrip("/")
    return ok({"url": f"{base}/uploads/{save_name}", "fileID": f"{base}/uploads/{save_name}"})


@router.get("/health")
def health():
    return ok({"service": "carpool-python-backend", "status": "running"})
