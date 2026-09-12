/**
 * 空状态占位组件：圆形图标 + 主文案 + 引导文案，支持可选的操作按钮
 */
import { View, Text, Button } from '@tarojs/components'
import styles from './index.module.scss'

interface EmptyProps {
  text?: string
  hint?: string
  actionText?: string
  onAction?: () => void
}

/** 空状态占位：图标 + 主文案 + 引导文案 + 可选操作按钮 */
export default function Empty({ text = '暂无内容', hint, actionText, onAction }: EmptyProps) {
  return (
    <View className={styles.wrapper}>
      <View className={styles.iconCircle}>
        <View className={styles.iconDot} />
      </View>
      <Text className={styles.text}>{text}</Text>
      {hint ? <Text className={styles.hint}>{hint}</Text> : null}
      {actionText && onAction ? (
        <Button className={styles.actionBtn} onClick={onAction}>
          {actionText}
        </Button>
      ) : null}
    </View>
  )
}
