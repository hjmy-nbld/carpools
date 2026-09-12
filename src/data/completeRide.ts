/**
 * H5 Mock：完成拼车。拼车组置为 completed，用户完成数 +1、信用分 +1（上限 120），并推送评价提醒系统消息。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import type { RideGroup } from '@/types'

interface CompleteRideEvent {
  groupId: string
}

export default async function completeRide(
  event: CompleteRideEvent
): Promise<{ group: RideGroup }> {
  const db = getDB()
  const group = db.groups.find((g) => g.id === event.groupId)
  if (!group) throw new Error('拼车组不存在')

  const now = Date.now()
  group.status = 'completed'
  group.completedAt = now

  const req = db.requests.find((r) => r.groupId === group.id && r.openid === SELF_OPENID)
  if (req) req.status = 'completed'

  if (db.user) {
    db.user.finishedCount = (db.user.finishedCount || 0) + 1
    db.user.creditScore = Math.min(120, db.user.creditScore + 1)
  }

  db.messages.push({
    id: genId('msg'),
    groupId: group.id,
    fromOpenid: 'system',
    fromName: '系统通知',
    avatar: '',
    type: 'system',
    content: '拼车已完成，感谢同行！别忘了给同行的同学做个评价～',
    createTime: now
  })
  saveDB(db)
  console.info('[MockCompleteRide] finished:', group.id)

  return { group }
}
