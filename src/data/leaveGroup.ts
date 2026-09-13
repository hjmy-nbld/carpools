/**
 * H5 Mock：退出拼车组。拼车组与本人请求置为 canceled，信用分扣减 5 分并联动处置
 * （<85 警告 / <75 冻结 30 天 / <70 销号），记录退出时间触发 2 分钟匹配冷却，并推送系统通知。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import {
  CREDIT_DELETE_SCORE,
  CREDIT_FREEZE_DAYS,
  CREDIT_FREEZE_SCORE,
  CREDIT_WARN_SCORE,
  LEAVE_MATCH_COOLDOWN_MS
} from '@/config'
import { applyCredit } from '@/utils/credit'
import type { RideGroup, UserStatus } from '@/types'

interface LeaveGroupEvent {
  groupId: string
}

interface LeaveResult {
  group: RideGroup
  creditScore: number
  creditDelta: number
  status: UserStatus
  frozenUntil?: number | null
  lastLeaveAt?: number | null
  matchCooldownUntil: number
}

/** 协商阶段退出：信用分扣减 */
const LEAVE_CREDIT_PENALTY = 5

export default async function leaveGroup(event: LeaveGroupEvent): Promise<LeaveResult> {
  const db = getDB()
  const group = db.groups.find((g) => g.id === event.groupId)
  if (!group) throw new Error('拼车组不存在')

  const now = Date.now()
  group.status = 'canceled'
  group.canceledAt = now

  const req = db.requests.find((r) => r.groupId === group.id && r.openid === SELF_OPENID)
  if (req) req.status = 'canceled'

  if (db.user) {
    db.user.lastLeaveAt = now
    applyCredit(db.user, -LEAVE_CREDIT_PENALTY, now)
  }

  // 按处置结果拼接通知文案（与后端 leaveGroup 一致）
  let extra = '，且 2 分钟内无法再次匹配'
  if (db.user?.status === 'deleted') {
    extra += `；当前信用分已低于 ${CREDIT_DELETE_SCORE} 分，账号已被注销`
  } else if (db.user?.status === 'frozen') {
    extra += `；信用分低于 ${CREDIT_FREEZE_SCORE} 分，账号已冻结 ${CREDIT_FREEZE_DAYS} 天`
  } else if (db.user?.status === 'warned') {
    extra += `；信用分低于 ${CREDIT_WARN_SCORE} 分已被警告，请珍惜信用`
  }

  db.messages.push({
    id: genId('msg'),
    groupId: group.id,
    fromOpenid: 'system',
    fromName: '系统通知',
    avatar: '',
    type: 'system',
    content: `你已退出本次拼车，临时聊天将关闭，信用分 -${LEAVE_CREDIT_PENALTY}${extra}。`,
    createTime: now
  })
  saveDB(db)
  console.info('[MockLeaveGroup] credit -', LEAVE_CREDIT_PENALTY, 'status:', db.user?.status)

  return {
    group,
    creditScore: db.user?.creditScore ?? 0,
    creditDelta: -LEAVE_CREDIT_PENALTY,
    status: db.user?.status ?? 'normal',
    frozenUntil: db.user?.frozenUntil ?? null,
    lastLeaveAt: db.user?.lastLeaveAt ?? null,
    matchCooldownUntil: now + LEAVE_MATCH_COOLDOWN_MS
  }
}
