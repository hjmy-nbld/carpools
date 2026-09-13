"""信用分规则：分值钳制与账号状态联动。

规则（阈值均为严格小于触发）：
- 信用分区间 0~100；
- <85 警告（warned）：功能不受限，仅在前端提示；
- <75 冻结 30 天（frozen）：冻结期内无法发起拼车匹配，到期自动解冻为 warned；
- <70 销号（deleted）：账号无法继续使用。
"""
from .config import (
    BUSINESS_TZ_OFFSET_MS,
    COMPLETE_CREDIT_REWARD,
    CREDIT_DELETE_SCORE,
    CREDIT_DAILY_REWARD_LIMIT,
    CREDIT_FREEZE_SCORE,
    CREDIT_MAX,
    CREDIT_MIN,
    CREDIT_REWARD_MIN_INTERVAL_SECONDS,
    CREDIT_WARN_SCORE,
    FREEZE_DAYS,
)
from .models import User

FREEZE_MS = FREEZE_DAYS * 24 * 60 * 60 * 1000
DAY_MS = 24 * 60 * 60 * 1000
REWARD_INTERVAL_MS = CREDIT_REWARD_MIN_INTERVAL_SECONDS * 1000


def day_start_ms(now: int) -> int:
    """业务时区（UTC+8）自然日 00:00 的毫秒时间戳。"""
    shifted = now + BUSINESS_TZ_OFFSET_MS
    return (shifted // DAY_MS) * DAY_MS - BUSINESS_TZ_OFFSET_MS


def apply_credit(user: User, delta: int, now: int) -> None:
    """调整信用分并同步账号状态（扣分 / 加分后统一调用，调用方负责 commit）。"""
    score = max(CREDIT_MIN, min(CREDIT_MAX, int(user.credit_score or 0) + delta))
    user.credit_score = score
    user.frozen_until = None

    if score < CREDIT_DELETE_SCORE:
        user.status = "deleted"
    elif score < CREDIT_FREEZE_SCORE:
        user.status = "frozen"
        user.frozen_until = now + FREEZE_MS
    elif score < CREDIT_WARN_SCORE:
        user.status = "warned"
    else:
        user.status = "normal"


def unfreeze_if_due(user: User, now: int) -> bool:
    """冻结到期自动解冻。到期后即使分数仍低于冻结阈值，也只降级为 warned，
    给用户通过完成行程恢复信用的机会；返回是否发生了解冻。"""
    if user.status != "frozen":
        return False
    if user.frozen_until and now < user.frozen_until:
        return False
    user.status = "warned" if (user.credit_score or 0) < CREDIT_WARN_SCORE else "normal"
    user.frozen_until = None
    return True


def grant_completion_reward(user: User, now: int) -> dict:
    """完成行程的信用分 +1 防刷校验（调用方负责 commit）。

    规则：每个自然日（UTC+8）最多 CREDIT_DAILY_REWARD_LIMIT 次加分，
    且第 2 次距第 1 次至少间隔 CREDIT_REWARD_MIN_INTERVAL_SECONDS。
    不满足时行程仍正常完成，只是本次不加信用分。
    返回 {credited, reason, waitSeconds, nextAvailableAt, todayCount}。
    """
    start = day_start_ms(now)
    rewards = [ts for ts in (user.credit_rewards or []) if isinstance(ts, int) and ts >= start]

    if len(rewards) >= CREDIT_DAILY_REWARD_LIMIT:
        return {
            "credited": False,
            "reason": "daily_limit",
            "waitSeconds": max(0, (start + DAY_MS - now) // 1000),
            "nextAvailableAt": start + DAY_MS,
            "todayCount": len(rewards),
        }

    if rewards and now - rewards[-1] < REWARD_INTERVAL_MS:
        next_at = rewards[-1] + REWARD_INTERVAL_MS
        return {
            "credited": False,
            "reason": "interval",
            "waitSeconds": max(0, (next_at - now) // 1000),
            "nextAvailableAt": next_at,
            "todayCount": len(rewards),
        }

    # 校验通过：记录加分时间（仅保留今日记录）并加分
    rewards.append(now)
    user.credit_rewards = rewards
    apply_credit(user, COMPLETE_CREDIT_REWARD, now)
    return {
        "credited": True,
        "reason": None,
        "waitSeconds": 0,
        "nextAvailableAt": None,
        "todayCount": len(rewards),
    }


def format_remaining(ms: int) -> str:
    """把剩余毫秒格式化为中文时长，用于冻结 / 冷却提示。"""
    if ms <= 0:
        return "已结束"
    total_sec = max(1, ms // 1000)
    days, rem = divmod(total_sec, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)
    if days > 0:
        return f"{days} 天 {hours} 小时" if hours else f"{days} 天"
    if hours > 0:
        return f"{hours} 小时 {minutes} 分" if minutes else f"{hours} 小时"
    if minutes > 0:
        return f"{minutes} 分 {seconds} 秒" if seconds else f"{minutes} 分"
    return f"{seconds} 秒"
