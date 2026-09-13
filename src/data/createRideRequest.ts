/**
 * H5 Mock：创建拼车请求。写入 waiting 请求并登记 5 秒后第 2 人、8 秒后第 3 人加入的模拟匹配计划。
 * 冻结账号 / 中途退出 2 分钟冷却期内拒绝发起（与后端 createRideRequest 规则一致）。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import { CREDIT_FREEZE_SCORE, LEAVE_MATCH_COOLDOWN_MS, CREDIT_WARN_SCORE } from '@/config'
import { matchCooldownRemainMs, formatRemain } from '@/utils/credit'
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

  // 冻结到期自动解冻（与后端 unfreeze_if_due 一致）
  if (db.user && db.user.status === 'frozen') {
    if (db.user.frozenUntil && db.user.frozenUntil > now) {
      throw new Error(
        `账号已被冻结（信用分低于 ${CREDIT_FREEZE_SCORE} 分），` +
        `${formatRemain(db.user.frozenUntil - now)}后自动解冻，暂无法发起拼车`
      )
    }
    db.user.status = db.user.creditScore < CREDIT_WARN_SCORE ? 'warned' : 'normal'
    db.user.frozenUntil = null
  }

  // 中途退出后的 2 分钟匹配冷却
  const cooldownMs = db.user ? matchCooldownRemainMs(db.user, now) : 0
  if (cooldownMs > 0) {
    throw new Error(`中途退出后 ${LEAVE_MATCH_COOLDOWN_MS / 60000} 分钟内无法再次匹配，请等待 ${formatRemain(cooldownMs)}`)
  }

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
