/**
 * H5 Mock：退出拼车组。拼车组与本人请求置为 canceled，信用分扣减 5 分，并推送系统通知。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import type { RideGroup } from '@/types'

interface LeaveGroupEvent {
  groupId: string
}

interface LeaveResult {
  group: RideGroup
  creditScore: number
  creditDelta: number
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
    db.user.creditScore = Math.max(0, db.user.creditScore - LEAVE_CREDIT_PENALTY)
  }

  db.messages.push({
    id: genId('msg'),
    groupId: group.id,
    fromOpenid: 'system',
    fromName: '系统通知',
    avatar: '',
    type: 'system',
    content: `你已退出本次拼车，临时聊天将关闭，信用分 -${LEAVE_CREDIT_PENALTY}。`,
    createTime: now
  })
  saveDB(db)
  console.info('[MockLeaveGroup] credit -', LEAVE_CREDIT_PENALTY)

  return {
    group,
    creditScore: db.user?.creditScore ?? 0,
    creditDelta: -LEAVE_CREDIT_PENALTY
  }
}
