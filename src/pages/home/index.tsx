/**
 * 首页页面
 *
 * 展示公告垂直轮播、进行中行程快捷卡片，并提供进校 / 离校两个方向的拼车发起入口。
 */
import { useState } from 'react'
import { View, Text, Button, Swiper, SwiperItem } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { callFunction, isLoggedIn } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import { GPS_RADIUS, CREDIT_FREEZE_DAYS, CREDIT_FREEZE_SCORE } from '@/config'
import { freezeRemainMs, matchCooldownRemainMs, formatRemain } from '@/utils/credit'
import RouteTag from '@/components/RouteTag'
import type { Announcement, Direction, TripRecord } from '@/types'
import styles from './index.module.scss'

export default function HomePage() {
  const { user, init } = useUserStore()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [activeTrip, setActiveTrip] = useState<TripRecord | null>(null)

  useDidShow(() => {
    init()
    loadData()
  })

  const loadData = async () => {
    try {
      // 公告无需登录；行程接口需要登录态，未选择测试账号时跳过
      const anns = await callFunction<Announcement[]>('getAnnouncements')
      setAnnouncements(anns || [])
      if (!isLoggedIn()) {
        setActiveTrip(null)
        return
      }
      const trips = await callFunction<TripRecord[]>('getTrips', { tab: 'active' })
      setActiveTrip(trips && trips.length > 0 ? trips[0] : null)
    } catch (err) {
      console.error('[Home] load data failed:', err)
      // 首屏增强内容加载失败仅 toast 提示，页面主体（方向入口）不依赖数据
      Taro.showToast({ title: (err as Error).message || '首页数据加载失败', icon: 'none' })
    }
  }

  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const goPublish = (direction: Direction) => {
    if (!user) {
      // 从未注册过的用户先去登记姓名，其余直接进入发起拼车
      goLogin()
      return
    }
    // 冻结期内禁止发起
    const frozenMs = freezeRemainMs(user)
    if (frozenMs > 0) {
      Taro.showModal({
        title: '账号冻结中',
        content: `信用分低于 ${CREDIT_FREEZE_SCORE} 分，账号已冻结 ${CREDIT_FREEZE_DAYS} 天，${formatRemain(frozenMs)}后自动解冻，暂无法发起拼车。`,
        showCancel: false,
        confirmColor: '#f53f3f'
      })
      return
    }
    // 中途退出后 2 分钟匹配冷却
    const cooldownMs = matchCooldownRemainMs(user)
    if (cooldownMs > 0) {
      Taro.showToast({ title: `退出冷却中，${formatRemain(cooldownMs)}后可再匹配`, icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/publish/index?direction=${direction}` })
  }

  const goActiveTrip = () => {
    if (!activeTrip) return
    if (activeTrip.status === 'waiting' && activeTrip.requestId) {
      Taro.navigateTo({ url: `/pages/matching/index?requestId=${activeTrip.requestId}` })
    } else if (activeTrip.groupId) {
      Taro.navigateTo({ url: `/pages/chat-detail/index?groupId=${activeTrip.groupId}` })
    }
  }

  return (
    <View className={styles.page}>
      {/* 顶部欢迎区 */}
      <View className={styles.hero}>
        <View className={styles.helloRow}>
          <View className={styles.helloText}>
            <Text className={styles.schoolName}>{user?.school || '北京化工大学（昌平校区）'}</Text>
            <Text className={styles.helloSub}>地铁口 · 校门口，同路同学一起拼</Text>
          </View>
          <View className={styles.brandBadge}>校园即时拼车</View>
        </View>
      </View>

      {/* 公告条 */}
      {announcements.length > 0 && (
        <View className={styles.announceBar}>
          <Text className={styles.announceTag}>公告</Text>
          <Swiper className={styles.announceSwiper} vertical autoplay circular interval={3500}>
            {announcements.map((a) => (
              <SwiperItem key={a.id}>
                <View className={styles.announceItem}>{a.title}：{a.content}</View>
              </SwiperItem>
            ))}
          </Swiper>
        </View>
      )}

      {/* 进行中行程 */}
      {activeTrip && (
        <View className={styles.activeCard}>
          <View className={styles.activeHeader}>
            <View>
              <Text className={styles.activeLabel}>
                <Text className={styles.pulseDot} />
                {activeTrip.status === 'waiting' ? '匹配进行中' : '拼车进行中'}
              </Text>
            </View>
            <RouteTag direction={activeTrip.direction} />
          </View>
          <Text className={styles.activeTitle}>
            {activeTrip.stationName} · {activeTrip.exitName}
          </Text>
          <Text className={styles.activeSub}>
            {activeTrip.status === 'waiting'
              ? `正在寻找同路同学（目标 ${activeTrip.targetSize} 人拼车）`
              : `已加入 ${activeTrip.members.length}/${activeTrip.targetSize} 人，点击进入临时群聊`}
          </Text>
          <Button className={styles.activeBtn} onClick={goActiveTrip}>
            {activeTrip.status === 'waiting' ? '查看匹配进度' : '进入临时群聊'}
          </Button>
        </View>
      )}

      <View className={styles.content}>
        <Text className={styles.sectionTitle}>选择你的出行方向</Text>

        <View className={styles.directionGrid}>
          {/* 地铁站 → 学校 */}
          <View className={`${styles.dirCard} ${styles.dirCardMetro}`} onClick={() => goPublish('metro2school')}>
            <View className={styles.dirCardIcon}>
              <Text className={styles.dirCardIconText}>地铁</Text>
            </View>
            <View>
              <View className={styles.dirCardTitle}>地铁站 → 学校</View>
              <View className={styles.dirCardSub}>下了地铁直接拼，到校门口更快更省</View>
            </View>
            <View className={styles.dirCardFooter}>
              <Text className={styles.dirCardTip}>地铁出口集合 · {GPS_RADIUS} 米内可发起</Text>
              <Text className={styles.dirCardGo}>去拼车 →</Text>
            </View>
          </View>

          {/* 学校 → 地铁站 */}
          <View className={`${styles.dirCard} ${styles.dirCardSchool}`} onClick={() => goPublish('school2metro')}>
            <View className={styles.dirCardIcon}>
              <Text className={styles.dirCardIconText}>校门</Text>
            </View>
            <View>
              <View className={styles.dirCardTitle}>学校 → 地铁站</View>
              <View className={styles.dirCardSub}>校门口出发拼车，赶地铁不迟到</View>
            </View>
            <View className={styles.dirCardFooter}>
              <Text className={styles.dirCardTip}>校门口集合 · 支持 2 / 3 人拼车</Text>
              <Text className={styles.dirCardGo}>去拼车 →</Text>
            </View>
          </View>
        </View>

        {/* 安全保障 */}
        <View className={styles.safeCard}>
          <View className={styles.safeGrid}>
            <View className={styles.safeItem}>
              <View className={`${styles.safeIcon} ${styles.safeIconBlue}`}>
                <Text className={styles.safeIconText}>✓</Text>
              </View>
              <Text className={styles.safeName}>真实姓名</Text>
              <Text className={styles.safeDesc}>企微自行核验</Text>
            </View>
            <View className={styles.safeItem}>
              <View className={`${styles.safeIcon} ${styles.safeIconCyan}`}>
                <Text className={styles.safeIconText}>◎</Text>
              </View>
              <Text className={styles.safeName}>GPS 验证</Text>
              <Text className={styles.safeDesc}>{GPS_RADIUS} 米范围内</Text>
            </View>
            <View className={styles.safeItem}>
              <View className={`${styles.safeIcon} ${styles.safeIconGreen}`}>
                <Text className={styles.safeIconText}>···</Text>
              </View>
              <Text className={styles.safeName}>临时聊天</Text>
              <Text className={styles.safeDesc}>无需交换联系方式</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
