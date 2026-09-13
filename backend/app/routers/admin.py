"""管理员后台接口 /api/admin/*。

全部需管理员登录态（require_admin）。与小程序业务接口隔离，避免权限混用。
"""
import csv
import io

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..credit import apply_credit, day_start_ms
from ..config import FREEZE_DAYS
from ..database import get_db
from ..deps import ApiError, log_admin_action, ok, require_admin
from ..models import (
    Admin,
    AdminLog,
    Announcement,
    Report,
    Review,
    RideGroup,
    Station,
    User,
)
from ..security import create_admin_token, verify_password
from ..serializers import gen_id, now_ms

router = APIRouter(prefix="/api/admin")


# ---------------- 鉴权 ----------------

@router.post("/login")
async def admin_login(request: Request, db: Session = Depends(get_db)):
    try:
        event = await request.json()
    except Exception:
        event = {}
    username = str(event.get("username") or "").strip()
    password = str(event.get("password") or "")
    if not username or not password:
        raise ApiError("请输入账号和密码")
    admin = db.query(Admin).filter(Admin.username == username).first()
    if admin is None or not verify_password(password, admin.password_hash, admin.salt):
        raise ApiError("账号或密码错误")
    return ok({"token": create_admin_token(admin.id), "name": admin.name or admin.username})


@router.get("/me")
def admin_me(admin: Admin = Depends(require_admin)):
    return ok({"id": admin.id, "name": admin.name or admin.username, "username": admin.username})


# ---------------- 数据看板 ----------------

@router.get("/stats")
def admin_stats(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    now = now_ms()
    start = day_start_ms(now)
    return ok({
        "todayNewUsers": db.query(func.count(User.openid)).filter(User.created_at >= start).scalar() or 0,
        "activeRides": db.query(func.count(RideGroup.id)).filter(RideGroup.status == "active").scalar() or 0,
        "pendingReports": db.query(func.count(Report.id)).filter(Report.status == "pending").scalar() or 0,
        "totalUsers": db.query(func.count(User.openid)).filter(User.is_bot.is_(False)).scalar() or 0,
        "todayCompleted": db.query(func.count(RideGroup.id)).filter(
            RideGroup.status == "completed", RideGroup.completed_at >= start
        ).scalar() or 0,
        "totalReports": db.query(func.count(Report.id)).scalar() or 0,
    })


# ---------------- 举报中心 ----------------

def _user_name(db: Session, openid: str) -> str:
    u = db.query(User).filter(User.openid == openid).first()
    if not u:
        return openid
    return u.real_name or u.nick_name


def _report_obj(db: Session, r: Report) -> dict:
    return {
        "id": r.id,
        "groupId": r.group_id,
        "reporterOpenid": r.reporter_openid,
        "reporterName": _user_name(db, r.reporter_openid),
        "reportedOpenid": r.reported_openid,
        "reportedName": _user_name(db, r.reported_openid),
        "reportedAvatar": (db.query(User).filter(User.openid == r.reported_openid).first() or type("X", (), {"avatar": ""})()).avatar,
        "reason": r.reason,
        "images": r.images or [],
        "description": r.description or "",
        "status": r.status,
        "adminNote": r.admin_note or "",
        "createTime": r.created_at,
    }


@router.get("/reports")
def admin_reports(
    status: str = "all",
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    q = db.query(Report)
    if status != "all":
        q = q.filter(Report.status == status)
    rows = q.order_by(Report.created_at.desc()).all()
    return ok([_report_obj(db, r) for r in rows])


@router.post("/reports/{report_id}/handle")
def admin_handle_report(
    report_id: str,
    event: dict | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    event = event or {}
    report = db.query(Report).filter(Report.id == report_id).first()
    if report is None:
        raise ApiError("举报不存在")

    action = str(event.get("action"))  # handle / reject / punish
    note = str(event.get("note") or "").strip()
    punish_type = str(event.get("punishType") or "")  # credit / freeze / delete
    credit_delta = int(event.get("creditDelta") or 0)
    freeze_days = int(event.get("freezeDays") or FREEZE_DAYS)

    if action == "handle":
        report.status = "handled"
    elif action == "reject":
        report.status = "rejected"
    elif action == "punish":
        report.status = "handled"
        target = db.query(User).filter(User.openid == report.reported_openid).first()
        if target is None:
            raise ApiError("被举报人不存在")
        now = now_ms()
        if punish_type == "credit":
            apply_credit(target, credit_delta, now)
            log_admin_action(db, admin, "adjust_credit", f"{target.real_name}({target.openid})",
                             f"举报{report_id}：信用分 {credit_delta:+d} → {target.credit_score}")
        elif punish_type == "freeze":
            target.status = "frozen"
            target.frozen_until = now + freeze_days * 86400_000
            log_admin_action(db, admin, "freeze", f"{target.real_name}({target.openid})",
                             f"举报{report_id}：冻结 {freeze_days} 天")
        elif punish_type == "delete":
            target.status = "deleted"
            log_admin_action(db, admin, "delete", f"{target.real_name}({target.openid})",
                             f"举报{report_id}：注销账号")
        else:
            raise ApiError("未知的处罚类型")

    if note:
        report.admin_note = note

    db.commit()
    db.refresh(report)
    return ok({"success": True, "report": _report_obj(db, report)})


# ---------------- 用户管理 ----------------

def _user_obj(u: User) -> dict:
    return {
        "openid": u.openid,
        "nickName": u.nick_name,
        "avatar": u.avatar,
        "realName": u.real_name,
        "school": u.school,
        "creditScore": u.credit_score,
        "status": u.status,
        "frozenUntil": u.frozen_until,
        "finishedCount": u.finished_count or 0,
        "isBot": bool(u.is_bot),
        "createTime": u.created_at,
    }


@router.get("/users")
def admin_users(
    keyword: str = "",
    status: str = "all",
    sort: str = "credit_desc",
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    q = db.query(User)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(User.real_name.like(like), User.nick_name.like(like), User.school.like(like)))
    if status != "all":
        q = q.filter(User.status == status)
    sort_map = {
        "credit_desc": User.credit_score.desc(),
        "credit_asc": User.credit_score.asc(),
        "finished_desc": User.finished_count.desc(),
        "created_desc": User.created_at.desc(),
    }
    q = q.order_by(sort_map.get(sort, User.credit_score.desc()))
    rows = q.all()
    return ok([_user_obj(u) for u in rows])


@router.post("/users/{openid}/adjust-credit")
def admin_adjust_credit(
    openid: str,
    event: dict | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    event = event or {}
    delta = int(event.get("delta") or 0)
    user = db.query(User).filter(User.openid == openid).first()
    if user is None:
        raise ApiError("用户不存在")
    before = user.credit_score
    apply_credit(user, delta, now_ms())
    log_admin_action(db, admin, "adjust_credit", f"{user.real_name}({openid})",
                     f"手动调整：{before} {delta:+d} → {user.credit_score}")
    db.commit()
    db.refresh(user)
    return ok(_user_obj(user))


@router.post("/users/{openid}/freeze")
def admin_freeze_user(
    openid: str,
    event: dict | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    days = int((event or {}).get("days") or FREEZE_DAYS)
    user = db.query(User).filter(User.openid == openid).first()
    if user is None:
        raise ApiError("用户不存在")
    user.status = "frozen"
    user.frozen_until = now_ms() + days * 86400_000
    log_admin_action(db, admin, "freeze", f"{user.real_name}({openid})", f"手动冻结 {days} 天")
    db.commit()
    db.refresh(user)
    return ok(_user_obj(user))


@router.post("/users/{openid}/unfreeze")
def admin_unfreeze_user(
    openid: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    user = db.query(User).filter(User.openid == openid).first()
    if user is None:
        raise ApiError("用户不存在")
    user.status = "warned" if (user.credit_score or 0) < 85 else "normal"
    user.frozen_until = None
    log_admin_action(db, admin, "unfreeze", f"{user.real_name}({openid})", "手动解冻")
    db.commit()
    db.refresh(user)
    return ok(_user_obj(user))


@router.post("/users/{openid}/delete")
def admin_delete_user(
    openid: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    user = db.query(User).filter(User.openid == openid).first()
    if user is None:
        raise ApiError("用户不存在")
    user.status = "deleted"
    log_admin_action(db, admin, "delete", f"{user.real_name}({openid})", "手动注销")
    db.commit()
    db.refresh(user)
    return ok(_user_obj(user))


@router.post("/users/{openid}/restore")
def admin_restore_user(
    openid: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    user = db.query(User).filter(User.openid == openid).first()
    if user is None:
        raise ApiError("用户不存在")
    user.status = "warned" if (user.credit_score or 0) < 85 else "normal"
    user.frozen_until = None
    log_admin_action(db, admin, "restore", f"{user.real_name}({openid})", "手动解封")
    db.commit()
    db.refresh(user)
    return ok(_user_obj(user))


# ---------------- 站点管理 ----------------

@router.get("/stations")
def admin_stations(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    rows = db.query(Station).order_by(Station.sort.asc()).all()
    out = []
    for s in rows:
        exits = s.exits or []
        first = exits[0] if exits else {}
        out.append({
            "id": s.id, "direction": s.direction, "name": s.name, "toName": s.to_name or "",
            "type": s.type, "exits": exits, "sort": s.sort,
            "latitude": first.get("latitude"),
            "longitude": first.get("longitude"),
            "exitName": first.get("name", ""),
        })
    return ok(out)


@router.post("/stations/save")
def admin_save_station(
    event: dict | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    event = event or {}
    sid = str(event.get("id") or "").strip()
    station = db.query(Station).filter(Station.id == sid).first() if sid else None
    if station is None:
        # 新增站点：序号默认为当前站点数 + 1（顺延）
        count = db.query(func.count(Station.id)).scalar() or 0
        station = Station(id=sid or gen_id("st"), sort=count + 1)
        db.add(station)
        is_new = True
    else:
        is_new = False
    station.direction = event.get("direction") or station.direction
    station.name = event.get("name") or station.name
    if "toName" in event:
        station.to_name = str(event.get("toName") or "").strip()
    st_type = str(event.get("type") or "").strip()
    if st_type in ("subway", "school"):
        station.type = st_type
    # 经纬度直接构造单出口；兼容旧 exits 字段
    if "latitude" in event and "longitude" in event:
        lat = float(event["latitude"])
        lng = float(event["longitude"])
        exit_name = str(event.get("exitName") or "").strip() or station.name or "集合点"
        station.exits = [{
            "id": gen_id("exit"),
            "name": exit_name,
            "latitude": lat,
            "longitude": lng,
        }]
    elif "exits" in event:
        station.exits = event.get("exits") or station.exits
    if "sort" in event and event["sort"] is not None:
        station.sort = int(event["sort"])
    db.commit()
    db.refresh(station)
    log_admin_action(db, admin, "station", f"{station.name}", "新增" if is_new else "编辑")
    db.commit()
    return ok({"success": True})


@router.post("/stations/{station_id}/delete")
def admin_delete_station(
    station_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    station = db.query(Station).filter(Station.id == station_id).first()
    if station is None:
        raise ApiError("站点不存在")
    log_admin_action(db, admin, "station", f"{station.name}", "删除")
    db.delete(station)
    db.commit()
    return ok({"success": True})


# ---------------- 公告管理 ----------------

@router.get("/announcements")
def admin_announcements(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    rows = db.query(Announcement).order_by(Announcement.sort.asc()).all()
    return ok([{"id": a.id, "title": a.title, "content": a.content, "sort": a.sort} for a in rows])


@router.post("/announcements/save")
def admin_save_announcement(
    event: dict | None = None,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    event = event or {}
    aid = str(event.get("id") or "").strip()
    ann = db.query(Announcement).filter(Announcement.id == aid).first() if aid else None
    if ann is None:
        ann = Announcement(id=aid or gen_id("ann"), sort=int(event.get("sort") or 0))
        db.add(ann)
        is_new = True
    else:
        is_new = False
    ann.title = event.get("title") or ann.title
    ann.content = event.get("content") or ann.content
    if "sort" in event:
        ann.sort = int(event["sort"])
    db.commit()
    db.refresh(ann)
    log_admin_action(db, admin, "announcement", f"{ann.title}", "新增" if is_new else "编辑")
    db.commit()
    return ok({"success": True})


@router.post("/announcements/{ann_id}/delete")
def admin_delete_announcement(
    ann_id: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if ann is None:
        raise ApiError("公告不存在")
    log_admin_action(db, admin, "announcement", f"{ann.title}", "删除")
    db.delete(ann)
    db.commit()
    return ok({"success": True})


# ---------------- 行程管理 ----------------

@router.get("/trips")
def admin_trips(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    rows = db.query(RideGroup).order_by(RideGroup.created_at.desc()).all()
    return ok([{
        "id": g.id, "direction": g.direction, "stationName": g.station_name,
        "exitName": g.exit_name, "targetSize": g.target_size, "status": g.status,
        "members": g.members or [], "price": g.price, "createTime": g.created_at,
        "completedAt": g.completed_at, "canceledAt": g.canceled_at,
    } for g in rows])


# ---------------- 评价查看 ----------------

@router.get("/reviews")
def admin_reviews(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    rows = db.query(Review).order_by(Review.created_at.desc()).all()

    def nm(oid):
        u = db.query(User).filter(User.openid == oid).first()
        return (u.real_name or u.nick_name) if u else oid

    return ok([{
        "id": r.id, "groupId": r.group_id,
        "fromName": nm(r.from_openid), "toName": nm(r.to_openid),
        "score": r.score, "tags": r.tags or [], "comment": r.comment or "",
        "createTime": r.created_at,
    } for r in rows])


# ---------------- 操作日志 ----------------

@router.get("/logs")
def admin_logs(db: Session = Depends(get_db), admin: Admin = Depends(require_admin)):
    rows = db.query(AdminLog).order_by(AdminLog.created_at.desc()).limit(500).all()
    return ok([{
        "id": l.id, "adminName": l.admin_name, "action": l.action,
        "target": l.target, "detail": l.detail, "createTime": l.created_at,
    } for l in rows])


# ---------------- 数据导出 ----------------

@router.get("/export/{kind}")
def admin_export(
    kind: str,
    db: Session = Depends(get_db),
    admin: Admin = Depends(require_admin),
):
    buf = io.StringIO()
    writer = csv.writer(buf)

    if kind == "users":
        writer.writerow(["openid", "真实姓名", "昵称", "学校", "信用分", "状态", "完成次数", "注册时间"])
        for u in db.query(User).order_by(User.credit_score.desc()).all():
            writer.writerow([
                u.openid, u.real_name, u.nick_name, u.school, u.credit_score,
                u.status, u.finished_count or 0, u.created_at,
            ])
        filename = "users.csv"
    elif kind == "reports":
        writer.writerow(["举报时间", "举报人", "被举报人", "原因", "状态", "描述", "管理员备注"])
        for r in db.query(Report).order_by(Report.created_at.desc()).all():
            writer.writerow([
                r.created_at, _user_name(db, r.reporter_openid),
                _user_name(db, r.reported_openid), r.reason, r.status,
                r.description or "", r.admin_note or "",
            ])
        filename = "reports.csv"
    else:
        raise ApiError("不支持的导出类型")

    content = buf.getvalue().encode("utf-8-sig")  # BOM 让 Excel 正确识别中文
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
