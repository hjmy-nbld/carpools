/**
 * 展示格式化工具：聊天时间、行程时间与匹配等待时长（mm:ss）
 */
import dayjs from 'dayjs'

/** 聊天 / 会话时间：今天显示 HH:mm，今年显示 MM-DD，更早显示 YYYY-MM-DD */
export function formatChatTime(timestamp: number): string {
  const d = dayjs(timestamp)
  const now = dayjs()
  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.isSame(now, 'year')) return d.format('MM-DD HH:mm')
  return d.format('YYYY-MM-DD')
}

/** 行程时间：MM月DD日 HH:mm */
export function formatTripTime(timestamp: number): string {
  return dayjs(timestamp).format('MM月DD日 HH:mm')
}

/** 匹配等待秒数 → mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
