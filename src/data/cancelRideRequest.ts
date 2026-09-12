/**
 * H5 Mock：取消拼车请求。仅将 waiting 状态的请求置为 canceled 并清除匹配计划。
 */
import { getDB, saveDB } from './_store'

interface CancelRideEvent {
  requestId: string
}

export default async function cancelRideRequest(
  event: CancelRideEvent
): Promise<{ canceled: boolean }> {
  const db = getDB()
  const req = db.requests.find((r) => r.id === event.requestId)
  if (!req) throw new Error('拼车请求不存在')
  if (req.status === 'waiting') {
    req.status = 'canceled'
    delete db.matchPlan[req.id]
    saveDB(db)
    console.info('[MockCancelRide] request canceled:', req.id)
  }
  return { canceled: true }
}
