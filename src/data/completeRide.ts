/**
 * H5 Mock：完成拼车。拼车组置为 completed，完成数 +1；信用分 +1 走防刷校验
 * （UTC+8 每日最多 2 次、两次间隔至少 3 小时，不满足则本次不加分），并推送评价提醒系统消息。
 * 同一拼车重复完成幂等返回，不再增加完成数 / 信用分。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import { grantCompletionReward, formatRemain } from '@/utils/credit'
import type { CompleteRideResult } from '@/types'

interface CompleteRideEvent {
  groupId: string
}

export default async function completeRide(
  event: CompleteRideEvent
): Promise<CompleteRideResult> {
  const db = getDB()
  const group = db.groups.find((g) => g.id === event.groupId)
  if (!group) throw new Error('拼车组不存在')

  const now = Date.now()
  const req = db.requests.find((r) => r.groupId === group.id && r.openid === SELF_OPENID)

  // 幂等：重复完成直接返回现状
  if (req && req.status === 'completed') {
    return {
      group,
      credited: false,
      reason: 'already_completed',
      waitSeconds: 0,
      nextAvailableAt: null,
      todayCount: 0
    }
  }

  group.status = 'completed'
  group.completedAt = now
  if (req) req.status = 'completed'

  let content = '拼车已完成，感谢同行！别忘了给同行的同学做个评价～'
  let result: Omit<CompleteRideResult, 'group'>

  if (db.user) {
    db.user.finishedCount = (db.user.finishedCount || 0) + 1
    const reward = grantCompletionReward(db.user, now)
    result = {
      credited: reward.credited,
      reason: reward.reason,
      waitSeconds: reward.waitSeconds,
      nextAvailableAt: reward.nextAvailableAt,
      todayCount: reward.todayCount
    }
    if (reward.credited) {
      content = '拼车已完成，感谢同行！信用分 +1，别忘了给同行的同学做个评价～'
    } else if (reward.reason === 'daily_limit') {
      content = '拼车已完成，感谢同行！今日信用分奖励已达上限（每天最多 2 次），本次不再加分，明天 00:00 后恢复。'
    } else {
      content = `拼车已完成，感谢同行！距上次加分不足 3 小时，本次不再加分；请等待 ${formatRemain(
        (reward.nextAvailableAt || now) - now
      )}后再完成下一行程。`
    }
  } else {
    result = { credited: false, reason: null, waitSeconds: 0, nextAvailableAt: null, todayCount: 0 }
  }

  db.messages.push({
    id: genId('msg'),
    groupId: group.id,
    fromOpenid: 'system',
    fromName: '系统通知',
    avatar: '',
    type: 'system',
    content,
    createTime: now
  })
  saveDB(db)
  console.info('[MockCompleteRide] finished:', group.id, 'credited:', result.credited, result.reason ?? '')

  return { group, ...result }
}
