/**
 * 我的行程页面
 *
 * tabBar 行程页，按进行中 / 已完成 / 已取消分页加载行程记录，支持继续匹配、进入群聊与去评价。
 */
import { useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction, isLoggedIn } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import Empty from '@/components/Empty'
import RouteTag from '@/components/RouteTag'
import { formatTripTime } from '@/utils/format'
import type { TripRecord } from '@/types'
import styles from './index.module.scss'

type TabKey = 'active' | 'completed' | 'canceled'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'canceled', label: '已取消' }
]

const STATUS_TEXT: Record<TripRecord['status'], string> = {
  waiting: '匹配中',
  active: '拼车中',
  completed: '已完成',
  canceled: '已取消'
}

export default function TripsPage() {
  const { user, init } = useUserStore()
  const [tab, setTab] = useState<TabKey>('active')
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    init()
    loadTrips(tab)
  })

  const loadTrips = async (key: TabKey) => {
    setLoaded(false)
    setLoadError('')
    if (!isLoggedIn()) {
      setTrips([])
      setLoaded(true)
      return
    }
    try {
      const list = await callFunction<TripRecord[]>('getTrips', { tab: key })
      setTrips(list || [])
    } catch (err) {
      console.error('[Trips] load failed:', err)
      setTrips([])
      setLoadError((err as Error).message || '行程加载失败')
    } finally {
      setLoaded(true)
    }
  }

  const switchTab = (key: TabKey) => {
    if (key === tab) return
    setTab(key)
    loadTrips(key)
  }

  const goMatching = (requestId?: string) => {
    if (!requestId) return
    Taro.navigateTo({ url: `/pages/matching/index?requestId=${requestId}` })
  }

  const goChat = (groupId?: string) => {
    if (!groupId) return
    Taro.navigateTo({ url: `/pages/chat-detail/index?groupId=${groupId}` })
  }

  const goReview = (trip: TripRecord) => {
    const peer = trip.members.find((m) => m.openid !== user?.openid)
    if (!peer || !trip.groupId) return
    Taro.navigateTo({
      url: `/pages/review/index?groupId=${trip.groupId}&toOpenid=${peer.openid}&toName=${encodeURIComponent(
        peer.realName || peer.nickName
      )}`
    })
  }

  const goHome = () => {
    Taro.switchTab({ url: '/pages/home/index' })
  }

  const emptyTextMap: Record<TabKey, string> = {
    active: '暂无进行中的行程',
    completed: '还没有已完成的拼车',
    canceled: '没有已取消的行程'
  }

  return (
    <View className={styles.page}>
      <View className={styles.tabs}>
        {TABS.map((t) => (
          <Button
            key={t.key}
            className={classnames(styles.tab, tab === t.key && styles.tabActive)}
            onClick={() => switchTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </View>

      <View className={styles.list}>
        {loaded && loadError && (
          <Empty text="加载失败" hint={loadError} actionText="点击重试" onAction={() => loadTrips(tab)} />
        )}

        {loaded && !loadError && trips.length === 0 && (
          <Empty
            text={emptyTextMap[tab]}
            hint={tab === 'active' ? '发起拼车后，可在此查看匹配进度与拼车状态' : '拼车记录会展示在这里'}
            actionText={tab === 'active' ? '去发起拼车' : undefined}
            onAction={tab === 'active' ? goHome : undefined}
          />
        )}

        {trips.map((trip) => (
          <View key={trip.id} className={styles.tripCard}>
            <View className={styles.tripTop}>
              <RouteTag direction={trip.direction} />
              <Text className={classnames(styles.tripStatus, styles[trip.status])}>
                {STATUS_TEXT[trip.status]}
              </Text>
            </View>
            <Text className={styles.tripTitle}>
              {trip.stationName} · {trip.exitName}
            </Text>
            <View className={styles.tripMeta}>
              <Text>{formatTripTime(trip.createTime)}</Text>
              <Text className={styles.dot}>|</Text>
              <Text>{trip.targetSize} 人拼车</Text>
              <Text className={styles.dot}>|</Text>
              <Text className={styles.price}>参考约 {trip.price} 元/人</Text>
            </View>
            <View className={styles.tripFooter}>
              <View className={styles.avatarStack}>
                {trip.members.length > 0 ? (
                  trip.members.slice(0, 3).map((m, i) => (
                    <Image key={`${m.openid}-${i}`} className={styles.tripAvatar} src={m.avatar} />
                  ))
                ) : (
                  <Image className={styles.tripAvatar} src={user?.avatar || ''} />
                )}
              </View>
              <View className={styles.tripActions}>
                {trip.status === 'waiting' && (
                  <Button className={`${styles.miniBtn} ${styles.miniPrimary}`} onClick={() => goMatching(trip.requestId)}>
                    继续匹配
                  </Button>
                )}
                {trip.status === 'active' && (
                  <Button className={`${styles.miniBtn} ${styles.miniSuccess}`} onClick={() => goChat(trip.groupId)}>
                    进入群聊
                  </Button>
                )}
                {trip.status === 'completed' && !trip.reviewed && (
                  <Button className={`${styles.miniBtn} ${styles.miniPrimary}`} onClick={() => goReview(trip)}>
                    去评价
                  </Button>
                )}
                {(trip.status === 'completed' || trip.status === 'canceled') && (
                  <Button className={`${styles.miniBtn} ${styles.miniGhost}`} onClick={goHome}>
                    再次拼车
                  </Button>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}
