/**
 * H5 Mock：获取行程列表。合并我的拼车请求、拼车组与预置历史行程，按 active/completed/canceled 过滤并倒序返回。
 */
import { getDB, SELF_OPENID, buildSelfMember } from './_store'
import type { TripRecord } from '@/types'

type TripTab = 'active' | 'completed' | 'canceled'

interface GetTripsEvent {
  tab: TripTab
}

function mapStatus(requestStatus: string, groupStatus?: string): TripRecord['status'] {
  if (requestStatus === 'waiting') return 'waiting'
  if (requestStatus === 'matched') return (groupStatus as TripRecord['status']) || 'active'
  if (requestStatus === 'completed') return 'completed'
  return 'canceled'
}

export default async function getTrips(event: GetTripsEvent): Promise<TripRecord[]> {
  const db = getDB()
  const self = buildSelfMember(db.user)
  const records: TripRecord[] = []

  db.requests
    .filter((r) => r.openid === SELF_OPENID)
    .forEach((req) => {
      const group = db.groups.find((g) => g.id === req.groupId)
      const status = mapStatus(req.status, group?.status)
      records.push({
        id: req.id,
        groupId: req.groupId,
        requestId: req.id,
        direction: req.direction,
        stationName: req.stationName,
        exitName: req.exitName,
        targetSize: req.targetSize,
        status,
        price: req.price,
        createTime: req.createTime,
        members: group ? group.members : [self],
        reviewed: group
          ? db.reviews.some((v) => v.groupId === group.id && v.fromOpenid === SELF_OPENID)
          : false
      })
    })

  // 预置历史行程（首次进入时有内容可看）
  db.tripSeed.forEach((seed) => {
    const members = seed.members.map((m) =>
      m.openid === SELF_OPENID
        ? {
            ...self,
            nickName: '我',
            realName: db.user?.realName || m.realName,
            avatar: db.user?.avatar || m.avatar
          }
        : m
    )
    records.push({
      ...seed,
      members,
      reviewed:
        seed.reviewed ||
        db.reviews.some((v) => v.groupId === seed.groupId && v.fromOpenid === SELF_OPENID)
    })
  })

  records.sort((a, b) => b.createTime - a.createTime)

  const filtered =
    event.tab === 'active'
      ? records.filter((r) => r.status === 'waiting' || r.status === 'active')
      : records.filter((r) => r.status === event.tab)
  return filtered
}
