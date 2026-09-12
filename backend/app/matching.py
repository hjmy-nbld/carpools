"""即时匹配引擎（由 createRideRequest / getRideStatus 驱动）。

匹配优先级：
1. 真人配对：同方向 + 同站点 + 同出口，且仍在等待的请求，先到先配；
2. 虚拟同学兜底：发起后 5 秒无真人，则机器人同学补位（第 2 人）；
   目标 3 人单在 8 秒时补第 3 人；
3. 90 秒仍未成团则超时。
"""
from sqlalchemy.orm import Session

from .config import BOT_SECOND_JOIN_SECONDS, BOT_THIRD_JOIN_SECONDS, WAIT_TIMEOUT_SECONDS
from .models import Message, RideGroup, RideRequest, User
from .serializers import gen_id, member_obj, now_ms

BOT_OPENIDS = ["bot_lxy", "bot_cyn", "bot_zzm", "bot_wyc"]

GREETING = "你好！我已经到出口附近了，你们在哪呀～"


def _add_system(db: Session, group_id: str, content: str, ts: int) -> None:
    db.add(
        Message(
            id=gen_id("msg"),
            group_id=group_id,
            from_openid="system",
            from_name="系统通知",
            avatar="",
            type="system",
            content=content,
            created_at=ts,
        )
    )


def _add_greeting(db: Session, group_id: str, peer: User, ts: int) -> None:
    db.add(
        Message(
            id=gen_id("msg"),
            group_id=group_id,
            from_openid=peer.openid,
            from_name=peer.nick_name,
            avatar=peer.avatar,
            type="quick",
            content=GREETING,
            created_at=ts,
        )
    )


def form_group(db: Session, req_owner: RideRequest, req_joiner: RideRequest,
               owner_user: User, joiner_user: User, now: int) -> RideGroup:
    """两个请求（真人）拼成一组。"""
    group_id = gen_id("group")
    group = RideGroup(
        id=group_id,
        direction=req_owner.direction,
        station_name=req_owner.station_name,
        exit_name=req_owner.exit_name,
        target_size=req_owner.target_size,
        status="active",
        members=[member_obj(owner_user), member_obj(joiner_user)],
        price=req_owner.price,
        created_at=now,
    )
    db.add(group)
    req_owner.status = "matched"
    req_owner.group_id = group_id
    req_joiner.status = "matched"
    req_joiner.group_id = group_id
    _add_system(db, group_id, f"匹配成功！临时拼车小组已建立（2/{req_owner.target_size}），请尽快沟通集合细节。", now)
    _add_greeting(db, group_id, joiner_user, now)
    db.commit()
    db.refresh(group)
    return group


def _find_human_peer(db: Session, req: RideRequest) -> RideRequest | None:
    """查找可配对的真人请求。

    with_for_update() 行锁：并发轮询时后到的事务会阻塞等待，
    锁释放后读到的对方状态已是 matched，从而避免同一 peer 被双重组队。
    """
    return (
        db.query(RideRequest)
        .filter(
            RideRequest.status == "waiting",
            RideRequest.openid != req.openid,
            RideRequest.direction == req.direction,
            RideRequest.station_id == req.station_id,
            RideRequest.exit_id == req.exit_id,
        )
        .order_by(RideRequest.created_at.asc())
        .with_for_update()
        .first()
    )


def _get_bot(db: Session, openid: str) -> User:
    return db.query(User).filter(User.openid == openid, User.is_bot.is_(True)).first()


def bot_fill(db: Session, req: RideRequest, elapsed: int, now: int) -> RideGroup | None:
    """虚拟同学兜底补位；返回（可能新建的）拼车组。"""
    existing = db.query(RideGroup).filter(RideGroup.id == req.group_id).first() if req.group_id else None

    # 第 2 人：5 秒兜底
    if existing is None and elapsed >= BOT_SECOND_JOIN_SECONDS:
        bot = _get_bot(db, BOT_OPENIDS[0])
        if bot is None:
            return None
        group_id = gen_id("group")
        me = db.query(User).filter(User.openid == req.openid).first()
        group = RideGroup(
            id=group_id,
            direction=req.direction,
            station_name=req.station_name,
            exit_name=req.exit_name,
            target_size=req.target_size,
            status="active",
            members=[member_obj(me), member_obj(bot)] if me else [member_obj(bot)],
            price=req.price,
            created_at=now,
        )
        db.add(group)
        req.status = "matched"
        req.group_id = group_id
        _add_system(db, group_id, f"匹配成功！临时拼车小组已建立（2/{req.target_size}），请尽快沟通集合细节。", now)
        _add_greeting(db, group_id, bot, now)
        db.commit()
        db.refresh(group)
        return group

    # 第 3 人：3 人单 8 秒补位
    if existing is not None and req.target_size == 3 and len(existing.members or []) == 2:
        if elapsed >= BOT_THIRD_JOIN_SECONDS:
            bot2 = _get_bot(db, BOT_OPENIDS[2])
            if bot2 is not None:
                members = list(existing.members or [])
                members.append(member_obj(bot2))
                existing.members = members
                _add_system(db, existing.id, f"{bot2.real_name} 已加入拼车（3/3），人齐啦，出发吧！", now)
                db.commit()
                db.refresh(existing)
        return existing

    return existing


def try_match(db: Session, req: RideRequest, now: int) -> RideGroup | None:
    """轮询时调用：真人配对 → 机器人兜底 → 超时。返回拼车组（未成团为 None）。"""
    if req.group_id:
        group = db.query(RideGroup).filter(RideGroup.id == req.group_id).first()
        elapsed = max(0, (now - req.created_at) // 1000)
        if group is not None:
            bot_fill(db, req, elapsed, now)
            db.refresh(group)
        return group

    # 先尝试真人配对（后发起者加入先发起者）
    peer_req = _find_human_peer(db, req)
    if peer_req is not None:
        owner_user = db.query(User).filter(User.openid == peer_req.openid).first()
        joiner_user = db.query(User).filter(User.openid == req.openid).first()
        return form_group(db, peer_req, req, owner_user, joiner_user, now)

    # 真人配对失败：先提交释放行锁，并刷新自身状态——
    # 锁等待期间对方可能已将我配走（req.group_id 已被回写），
    # 若不刷新会误走机器人兜底为已成团的我重复建群
    db.commit()
    db.refresh(req)
    if req.group_id:
        return db.query(RideGroup).filter(RideGroup.id == req.group_id).first()

    elapsed = max(0, (now - req.created_at) // 1000)
    if elapsed > WAIT_TIMEOUT_SECONDS:
        req.status = "timeout"
        db.commit()
        return None

    return bot_fill(db, req, elapsed, now)
