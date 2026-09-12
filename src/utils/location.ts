/**
 * 定位工具：获取 GCJ02 坐标并以 Haversine 公式校验是否处于集合点 300 米围栏内
 *
 * 微信端调用 Taro.getLocation 真实定位；H5 预览环境返回距目标 56 米的模拟结果。
 */
import Taro from '@tarojs/taro'
import type { GpsVerifyResult } from '@/types'
import { GPS_RADIUS } from '@/config'

/** GPS 允许半径（米），定义于 src/config，此处 re-export 供页面引用 */
export { GPS_RADIUS }

const EARTH_RADIUS = 6371000

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Haversine 公式计算两个经纬度之间的球面距离（米）
 */
export function getDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(EARTH_RADIUS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * 校验用户当前位置是否在目标集合点 GPS_RADIUS 范围内。
 * 微信端调用真实定位；H5 预览环境返回模拟结果以便演示完整流程。
 */
export async function verifyLocation(target: {
  latitude: number
  longitude: number
}): Promise<GpsVerifyResult> {
  if (process.env.TARO_ENV !== 'weapp') {
    // 预览环境：模拟位于集合点 56 米处
    return {
      passed: true,
      distance: 56,
      latitude: target.latitude,
      longitude: target.longitude,
      mocked: true
    }
  }

  try {
    const res = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true })
    const distance = getDistance(
      res.latitude,
      res.longitude,
      target.latitude,
      target.longitude
    )
    console.info('[GPS] distance to target:', distance)
    return {
      passed: distance <= GPS_RADIUS,
      distance,
      latitude: res.latitude,
      longitude: res.longitude
    }
  } catch (err) {
    console.error('[GPS] getLocation failed:', err)
    throw err
  }
}
