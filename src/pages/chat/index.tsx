/**
 * 消息列表页面
 *
 * tabBar 消息页，拉取进行中拼车临时群的会话列表，展示最后一条消息、群状态并跳转群聊详情。
 */
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction, isLoggedIn } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import Empty from '@/components/Empty'
import RouteTag from '@/components/RouteTag'
import { formatChatTime } from '@/utils/format'
import type { ChatSession } from '@/types'
import styles from './index.module.scss'

export default function ChatPage() {
  const { user, init } = useUserStore()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    init()
    loadSessions()
  })

  const loadSessions = async () => {
    if (!isLoggedIn()) {
      setSessions([])
      setLoaded(true)
      return
    }
    setLoadError('')
    try {
      const list = await callFunction<ChatSession[]>('getChatList')
      setSessions(list || [])
    } catch (err) {
      console.error('[Chat] load sessions failed:', err)
      setSessions([])
      setLoadError((err as Error).message || '会话列表加载失败')
    } finally {
      setLoaded(true)
    }
  }

  const goDetail = (groupId: string) => {
    Taro.navigateTo({ url: `/pages/chat-detail/index?groupId=${groupId}` })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/home/index' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.headerTitle}>消息</Text>
        <Text className={styles.headerSub}>匹配成功后的临时拼车群，安全沟通无需交换联系方式</Text>
      </View>

      {loaded && loadError && (
        <Empty text="加载失败" hint={loadError} actionText="点击重试" onAction={loadSessions} />
      )}

      {loaded && !loadError && sessions.length === 0 && (
        <Empty
          text="还没有拼车会话"
          hint="发起拼车并匹配成功后，临时群聊会出现在这里"
          actionText="去发起拼车"
          onAction={goHome}
        />
      )}

      {sessions.map((s) => {
        const others = s.members.filter((m) => m.openid !== user?.openid)
        return (
          <View key={s.groupId} className={styles.sessionCard} onClick={() => goDetail(s.groupId)}>
            <View className={styles.avatarGroup}>
              <Image className={styles.avatarMain} src={others[0]?.avatar || user?.avatar || ''} />
              {s.memberCount >= 3 && others[1] && (
                <Image className={styles.avatarSub} src={others[1].avatar} />
              )}
            </View>
            <View className={styles.sessionInfo}>
              <View className={styles.sessionTop}>
                <Text className={styles.sessionTitle}>
                  {s.stationName} · {s.exitName}
                </Text>
                <Text className={styles.sessionTime}>{formatChatTime(s.lastTime)}</Text>
              </View>
              <View className={styles.sessionBottom}>
                <Text className={styles.sessionLast}>{s.lastMessage}</Text>
                <Text
                  className={classnames(
                    styles.sessionStatus,
                    s.status === 'active' && styles.active,
                    s.status === 'completed' && styles.completed,
                    s.status === 'canceled' && styles.canceled
                  )}
                >
                  {s.status === 'active'
                    ? `拼车中 ${s.memberCount}/${s.targetSize}`
                    : s.status === 'completed'
                      ? '已完成'
                      : '已取消'}
                </Text>
              </View>
              <View style={{ marginTop: '8rpx' }}>
                <RouteTag direction={s.direction} />
              </View>
            </View>
            <Text className={styles.arrow}>›</Text>
          </View>
        )
      })}
    </View>
  )
}
