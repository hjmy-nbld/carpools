/**
 * 匹配等待页面
 *
 * 发起拼车后轮询匹配状态，真人配对或机器人兜底成功时自动跳转临时群聊，
 * 90 秒超时弹窗提示并返回首页，等待期间也可主动取消匹配。
 */
import { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useLoad, useUnload } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction } from '@/services/cloud'
import { MATCHING_POLL_INTERVAL } from '@/config'
import { useUserStore } from '@/store/useUserStore'
import { formatDuration } from '@/utils/format'
import RouteTag from '@/components/RouteTag'
import type { Direction, MatchingStatus } from '@/types'
import styles from './index.module.scss'

interface RideCond {
  direction: Direction
  stationName: string
  exitName: string
  targetSize: number
}

const POLL_INTERVAL = MATCHING_POLL_INTERVAL

export default function MatchingPage() {
  const { user } = useUserStore()
  const [requestId, setRequestId] = useState('')
  const [cond, setCond] = useState<RideCond | null>(null)
  const [status, setStatus] = useState<MatchingStatus | null>(null)
  const [netFlaky, setNetFlaky] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigatedRef = useRef(false)
  const pollFailRef = useRef(0)

  useLoad((options) => {
    const id = options?.requestId || ''
    setRequestId(id)
    try {
      setCond(Taro.getStorageSync('last_ride_cond') || null)
    } catch (err) {
      console.error('[Matching] read cond failed:', err)
    }
    console.info('[Matching] start polling, requestId:', id)
  })

  useEffect(() => {
    if (!requestId) return
    let stopped = false

    const poll = async () => {
      try {
        const s = await callFunction<MatchingStatus>('getRideStatus', { requestId })
        pollFailRef.current = 0
        setNetFlaky(false)
        if (stopped || navigatedRef.current) return
        setStatus(s)

        if (s.status === 'matched' && s.group) {
          navigatedRef.current = true
          Taro.showToast({ title: '匹配成功！', icon: 'success' })
          setTimeout(() => {
            Taro.redirectTo({ url: `/pages/chat-detail/index?groupId=${s.group!.id}` })
          }, 900)
        } else if (s.status === 'timeout') {
          navigatedRef.current = true
          Taro.showModal({
            title: '本次匹配已超时',
            content: '当前时段同路同学较少，你可以稍后再试或更换集合点重新发起。',
            showCancel: false,
            confirmText: '我知道了',
            confirmColor: '#1e6fff',
            success: () => Taro.switchTab({ url: '/pages/home/index' })
          })
        } else if (s.status === 'canceled') {
          navigatedRef.current = true
          Taro.switchTab({ url: '/pages/home/index' })
        }
      } catch (err) {
        console.error('[Matching] poll failed:', err)
        // 轮询失败不弹窗（1.5 秒一弹会刷屏），连续多次失败才显示内联提示
        pollFailRef.current += 1
        if (pollFailRef.current >= 3) setNetFlaky(true)
      }
    }

    poll()
    timerRef.current = setInterval(poll, POLL_INTERVAL)
    return () => {
      stopped = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [requestId])

  useUnload(() => {
    if (timerRef.current) clearInterval(timerRef.current)
  })

  const handleCancel = () => {
    Taro.showModal({
      title: '退出匹配？',
      content: '匹配成功前退出不扣信用分，取消后将释放你的匹配席位。',
      confirmText: '退出匹配',
      cancelText: '继续等待',
      confirmColor: '#f53f3f',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await callFunction('cancelRideRequest', { requestId })
        } catch (err) {
          console.error('[Matching] cancel failed:', err)
        }
        Taro.switchTab({ url: '/pages/home/index' })
      }
    })
  }

  const peers = status?.group?.members.filter((m) => m.openid !== user?.openid) || []
  const joinedCount = status?.joinedCount || 1
  const targetSize = status?.targetSize || cond?.targetSize || 2
  const waiting = status?.status === 'waiting'

  return (
    <View className={styles.page}>
      {/* 雷达 */}
      <View className={styles.radarWrap}>
        <View className={classnames(styles.radarRing, styles.ring1)} />
        <View className={classnames(styles.radarRing, styles.ring2)} />
        <View className={classnames(styles.radarRing, styles.ring3)} />
        <View className={styles.radarCore}>
          <View className={styles.radarSweep} />
          <View className={styles.radarCenter}>
            <Text className={styles.radarCenterText}>同</Text>
          </View>
          {peers[0] && <Image className={classnames(styles.peerDot, styles.peerDot1)} src={peers[0].avatar} />}
          {peers[1] && <Image className={classnames(styles.peerDot, styles.peerDot2)} src={peers[1].avatar} />}
        </View>
      </View>

      <Text className={styles.statusTitle}>
        {waiting ? '正在为你匹配同校同学…' : joinedCount >= targetSize ? '人齐啦，准备出发！' : '已找到同行同学！'}
      </Text>
      <Text className={styles.statusSub}>
        {waiting ? '系统正在匹配同一集合点、同一人数需求的同学' : '即将进入临时聊天，请留意页面跳转'}
      </Text>
      <Text className={styles.timerText}>已等待 {formatDuration(status?.elapsed || 0)}</Text>
      {netFlaky && <Text className={styles.netHint}>网络不稳定，正在重试…</Text>}

      {/* 匹配条件 */}
      <View className={styles.condCard}>
        <View className={styles.condRow}>
          <Text className={styles.condLabel}>出行方向</Text>
          {cond ? <RouteTag direction={cond.direction} /> : <Text className={styles.condValue}>-</Text>}
        </View>
        <View className={styles.condRow}>
          <Text className={styles.condLabel}>集合地点</Text>
          <Text className={styles.condValue}>
            {cond ? `${cond.stationName} · ${cond.exitName}` : '加载中…'}
          </Text>
        </View>
        <View className={styles.condRow}>
          <Text className={styles.condLabel}>拼车人数</Text>
          <Text className={styles.condValue}>{targetSize} 人成行</Text>
        </View>
        <View className={styles.progressRow}>
          <View className={styles.progressAvatars}>
            <Image className={styles.avatar} src={user?.avatar || ''} />
            {peers.slice(0, targetSize - 1).map((m) => (
              <Image key={m.openid} className={styles.avatar} src={m.avatar} />
            ))}
            {Array.from({ length: Math.max(0, targetSize - 1 - peers.length) }).map((_, i) => (
              <View key={`empty-${i}`} className={styles.avatar} style={{ background: '#f2f3f5' }} />
            ))}
          </View>
          <Text className={styles.progressText}>
            {joinedCount} / {targetSize} 人{waiting ? '，平均等待约 30 秒' : ' 已加入'}
          </Text>
        </View>
      </View>

      <View className={styles.tipCard}>
        匹配期间请留在集合点附近不要走远；匹配成功后将自动进入临时聊天，拼车信息（报价 / 着装 / 照片）仅向同行同学展示。
      </View>

      <View className={styles.footer}>
        <Button className={styles.cancelBtn} onClick={handleCancel}>
          取消匹配
        </Button>
      </View>
    </View>
  )
}
