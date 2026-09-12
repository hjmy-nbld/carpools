/**
 * 通用卡片容器组件：白色圆角卡片，支持标题、右侧附加内容与 children 内容插槽
 */
import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface SectionCardProps {
  title?: string
  extra?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** 通用卡片容器：白色圆角 + 轻阴影，可选标题与右侧附加内容 */
export default function SectionCard({ title, extra, children, className }: SectionCardProps) {
  return (
    <View className={classnames(styles.card, className)}>
      {(title || extra) && (
        <View className={styles.header}>
          {title ? <Text className={styles.title}>{title}</Text> : <View />}
          {extra ? <View className={styles.extra}>{extra}</View> : null}
        </View>
      )}
      {children}
    </View>
  )
}
