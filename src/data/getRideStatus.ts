/**
 * H5 Mock：轮询拼车匹配状态。按 matchPlan 时间计划模拟匹配成功建组、第三人延迟补入与 90 秒超时。
 */
import { getDB, saveDB, genId, buildSelfMember, PEER_POOL } from './_store'
import type { MatchingStatus } from '@/types'

interface GetRideStatusEvent {
  requestId: string
}

const ESTIMATED_SECONDS = 30
const WAIT_TIMEOUT_SECONDS = 90

export default async function getRideStatus(
  event: GetRideStatusEvent
): Promise<MatchingStatus> {
  const db = getDB()
  const req = db.requests.find((r) => r.id === event.requestId)
  if (!req) throw new Error('拼车请求不存在')

  const now = Date.now()
  const elapsed = Math.max(0, Math.floor((now - req.createTime) / 1000))
  const plan = db.matchPlan[req.id]

  if (req.status === 'canceled') {
    return { status: 'canceled', elapsed, estimated: ESTIMATED_SECONDS, joinedCount: 1, targetSize: req.targetSize }
  }

  if (req.status === 'matched' && req.groupId) {
    const group = db.groups.find((g) => g.id === req.groupId)
    if (!group) throw new Error('拼车组不存在')

    // 三人单：第 3 名同学延迟补入
    if (req.targetSize === 3 && group.members.length === 2 && plan && now >= plan.thirdAt) {
      group.members.push(PEER_POOL[2])
      db.messages.push({
        id: genId('msg'),
        groupId: group.id,
        fromOpenid: 'system',
        fromName: '系统通知',
        avatar: '',
        type: 'system',
        content: `${PEER_POOL[2].realName} 已加入拼车（3/3），人齐啦，出发吧！`,
        createTime: now
      })
      saveDB(db)
    }

    return {
      status: 'matched',
      elapsed,
      estimated: ESTIMATED_SECONDS,
      joinedCount: group.members.length,
      targetSize: req.targetSize,
      group
    }
  }

  // 等待中
  if (elapsed > WAIT_TIMEOUT_SECONDS) {
    req.status = 'timeout'
    delete db.matchPlan[req.id]
    saveDB(db)
    return { status: 'timeout', elapsed, estimated: ESTIMATED_SECONDS, joinedCount: 1, targetSize: req.targetSize }
  }

  const secondAt = plan?.secondAt ?? now + 5000
  if (now >= secondAt) {
    // 匹配成功：建立拼车组
    const selfMember = buildSelfMember(db.user)
    const firstPeer = PEER_POOL[0]
    const groupId = genId('group')
    db.groups.push({
      id: groupId,
      direction: req.direction,
      stationName: req.stationName,
      exitName: req.exitName,
      targetSize: req.targetSize,
      status: 'active',
      members: [selfMember, firstPeer],
      price: req.price,
      createTime: now
    })
    req.status = 'matched'
    req.groupId = groupId
    db.messages.push(
      {
        id: genId('msg'),
        groupId,
        fromOpenid: 'system',
        fromName: '系统通知',
        avatar: '',
        type: 'system',
        content: `匹配成功！临时拼车小组已建立（2/${req.targetSize}），请尽快沟通集合细节。`,
        createTime: now
      },
      {
        id: genId('msg'),
        groupId,
        fromOpenid: firstPeer.openid,
        fromName: firstPeer.nickName,
        avatar: firstPeer.avatar,
        type: 'quick',
        content: '你好！我已经到出口附近了，你们在哪呀～',
        createTime: now + 1000
      }
    )
    saveDB(db)
    console.info('[MockGetRideStatus] matched group:', groupId)
    const group = db.groups.find((g) => g.id === groupId)!
    return {
      status: 'matched',
      elapsed,
      estimated: ESTIMATED_SECONDS,
      joinedCount: group.members.length,
      targetSize: req.targetSize,
      group
    }
  }

  return { status: 'waiting', elapsed, estimated: ESTIMATED_SECONDS, joinedCount: 1, targetSize: req.targetSize }
}
