/**
 * 出行方向标签组件：将 Direction 映射为“地铁站 → 学校 / 学校 → 地铁站”彩色徽章
 */
import { Text } from '@tarojs/components'
import classnames from 'classnames'
import type { Direction } from '@/types'
import styles from './index.module.scss'

interface RouteTagProps {
  direction: Direction
}

const LABEL_MAP: Record<Direction, string> = {
  metro2school: '地铁站 → 学校',
  school2metro: '学校 → 地铁站'
}

/** 出行方向标签：蓝 / 青双色语义 */
export default function RouteTag({ direction }: RouteTagProps) {
  return (
    <Text className={classnames(styles.tag, direction === 'metro2school' ? styles.metro : styles.school)}>
      {LABEL_MAP[direction]}
    </Text>
  )
}
