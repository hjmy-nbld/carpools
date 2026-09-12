/**
 * H5 Mock：创建拼车请求。写入 waiting 请求并登记 5 秒后第 2 人、8 秒后第 3 人加入的模拟匹配计划。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import type { Direction, RideRequest } from '@/types'

interface CreateRideEvent {
  direction: Direction
  stationId: string
  stationName: string
  exitId: string
  exitName: string
  targetSize: 2 | 3
  price: number
  waitLocation: string
  outfit: string
  photo: string
}

/** 演示环境匹配节奏：5 秒后第 2 人加入，8 秒后第 3 人加入 */
const SECOND_JOIN_DELAY = 5000
const THIRD_JOIN_DELAY = 8000

export default async function createRideRequest(
  event: CreateRideEvent
): Promise<RideRequest> {
  const db = getDB()
  const now = Date.now()
  const request: RideRequest = {
    id: genId('req'),
    openid: SELF_OPENID,
    direction: event.direction,
    stationId: event.stationId,
    stationName: event.stationName,
    exitId: event.exitId,
    exitName: event.exitName,
    targetSize: event.targetSize,
    price: event.price,
    waitLocation: event.waitLocation,
    outfit: event.outfit,
    photo: event.photo,
    status: 'waiting',
    createTime: now
  }
  db.requests.push(request)
  db.matchPlan[request.id] = {
    secondAt: now + SECOND_JOIN_DELAY,
    thirdAt: now + THIRD_JOIN_DELAY
  }
  saveDB(db)
  console.info('[MockCreateRide] request:', request.id, event.direction, event.exitName)
  return request
}
