/**
 * H5 Mock：按出行方向（进校/离校）返回 Mock 站点及其出口列表。
 */
import { MOCK_STATIONS } from './_store'
import type { Direction, Station } from '@/types'

interface GetStationsEvent {
  direction: Direction
}

export default async function getStations(
  event: GetStationsEvent
): Promise<Station[]> {
  return MOCK_STATIONS[event.direction] || []
}
