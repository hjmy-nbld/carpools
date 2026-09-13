/**
 * 信用分规则工具（与后端 app/credit.py 规则一致）
 *
 * - 信用分区间 0~100；
 * - <85 警告（warned，仅提示）；<75 冻结 30 天（frozen）；<70 销号（deleted）；
 * - 中途退出后 2 分钟内无法再次匹配；
 * - 完成行程加分防刷：UTC+8 自然日最多 2 次，两次间隔至少 3 小时。
 */
import {
  BUSINESS_TZ_OFFSET_MS,
  CREDIT_DELETE_SCORE,
  CREDIT_DAILY_REWARD_LIMIT,
  CREDIT_FREEZE_MS,
  CREDIT_FREEZE_SCORE,
  CREDIT_MAX_SCORE,
  CREDIT_REWARD_MIN_INTERVAL_MS,
  CREDIT_WARN_SCORE,
  LEAVE_MATCH_COOLDOWN_MS
} from '@/config'
import type { UserInfo } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000

/** 业务时区（UTC+8）自然日 00:00 的毫秒时间戳 */
export function dayStartMs(now: number = Date.now()): number {
  const shifted = now + BUSINESS_TZ_OFFSET_MS
  return Math.floor(shifted / DAY_MS) * DAY_MS - BUSINESS_TZ_OFFSET_MS
}

/** 信用等级文案（个人中心展示） */
export function creditLevel(score: number): string {
  if (score >= 95) return '信用优秀'
  if (score >= CREDIT_WARN_SCORE) return '信用良好'
  return '信用预警'
}

/** 冻结剩余毫秒（未冻结 / 已到期返回 0） */
export function freezeRemainMs(user: UserInfo | null, now: number = Date.now()): number {
  if (user?.status === 'frozen' && user.frozenUntil) {
    return Math.max(0, user.frozenUntil - now)
  }
  return 0
}

/** 中途退出后的匹配冷却剩余毫秒（无冷却返回 0） */
export function matchCooldownRemainMs(user: UserInfo | null, now: number = Date.now()): number {
  if (!user?.lastLeaveAt) return 0
  return Math.max(0, user.lastLeaveAt + LEAVE_MATCH_COOLDOWN_MS - now)
}

/** 剩余毫秒格式化为中文时长 */
export function formatRemain(ms: number): string {
  if (ms <= 0) return ''
  const totalSec = Math.ceil(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (days > 0) return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`
  if (hours > 0) return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
  if (minutes > 0) return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`
  return `${seconds} 秒`
}

/** 冷却剩余的 mm:ss 倒计时（发布页按钮用） */
export function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * 调整信用分并联动账号状态（H5 Mock 与后端 apply_credit 同逻辑）。
 * 直接修改传入的 user 对象，调用方负责持久化。
 */
export function applyCredit(user: UserInfo, delta: number, now: number = Date.now()): void {
  const score = Math.max(0, Math.min(CREDIT_MAX_SCORE, user.creditScore + delta))
  user.creditScore = score
  user.frozenUntil = null
  if (score < CREDIT_DELETE_SCORE) {
    user.status = 'deleted'
  } else if (score < CREDIT_FREEZE_SCORE) {
    user.status = 'frozen'
    user.frozenUntil = now + CREDIT_FREEZE_MS
  } else if (score < CREDIT_WARN_SCORE) {
    user.status = 'warned'
  } else {
    user.status = 'normal'
  }
}

/** 冻结到期自动解冻（H5 Mock 与后端 unfreeze_if_due 同逻辑），返回是否发生解冻 */
export function unfreezeIfDue(user: UserInfo, now: number = Date.now()): boolean {
  if (user.status !== 'frozen') return false
  if (user.frozenUntil && now < user.frozenUntil) return false
  user.status = user.creditScore < CREDIT_WARN_SCORE ? 'warned' : 'normal'
  user.frozenUntil = null
  return true
}

/** 加分防刷校验结果 */
export interface RewardResult {
  credited: boolean
  reason: 'daily_limit' | 'interval' | null
  waitSeconds: number
  nextAvailableAt: number | null
  todayCount: number
}

/**
 * 完成行程的信用分 +1 防刷校验（H5 Mock 与后端 grant_completion_reward 同逻辑）。
 * 通过则记录时间戳并实际加分，直接修改传入的 user 对象，调用方负责持久化。
 */
export function grantCompletionReward(user: UserInfo, now: number = Date.now()): RewardResult {
  const start = dayStartMs(now)
  const rewards = (user.creditRewards || []).filter((ts) => typeof ts === 'number' && ts >= start)

  if (rewards.length >= CREDIT_DAILY_REWARD_LIMIT) {
    return {
      credited: false,
      reason: 'daily_limit',
      waitSeconds: Math.max(0, Math.floor((start + DAY_MS - now) / 1000)),
      nextAvailableAt: start + DAY_MS,
      todayCount: rewards.length
    }
  }

  if (rewards.length > 0 && now - rewards[rewards.length - 1] < CREDIT_REWARD_MIN_INTERVAL_MS) {
    const nextAt = rewards[rewards.length - 1] + CREDIT_REWARD_MIN_INTERVAL_MS
    return {
      credited: false,
      reason: 'interval',
      waitSeconds: Math.max(0, Math.floor((nextAt - now) / 1000)),
      nextAvailableAt: nextAt,
      todayCount: rewards.length
    }
  }

  rewards.push(now)
  user.creditRewards = rewards
  applyCredit(user, 1, now)
  return { credited: true, reason: null, waitSeconds: 0, nextAvailableAt: null, todayCount: rewards.length }
}
