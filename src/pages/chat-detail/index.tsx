/**
 * 群聊详情页面
 *
 * 定时轮询临时群消息，支持系统消息 / 文字 / 图片 / 快捷常用语收发（含机器人自动回复消息展示），
 * 并提供企微联系核验弹窗、举报、完成与退出拼车操作。
 */
import { useEffect, useState } from 'react'
import { View, Text, Image, Button, Input, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction, uploadImage } from '@/services/cloud'
import { CHAT_POLL_INTERVAL } from '@/config'
import { useUserStore } from '@/store/useUserStore'
import RouteTag from '@/components/RouteTag'
import type { ChatMessage, ChatSession, MessageType } from '@/types'
import styles from './index.module.scss'

const QUICK_PHRASES = [
  '我已经到出口了',
  '我穿黑色外套，背深色书包',
  '稍等我 2 分钟',
  '我在扶梯 / 便利店旁等你',
  '看到你了，我招手！',
  '就在这个位置上车吧'
]

const POLL_INTERVAL = CHAT_POLL_INTERVAL

function normalizeTime(t: number | string): number {
  if (typeof t === 'number') return t
  const parsed = new Date(t).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

export default function ChatDetailPage() {
  const { user } = useUserStore()
  const [groupId, setGroupId] = useState('')
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [showQuick, setShowQuick] = useState(false)
  const [sending, setSending] = useState(false)
  const [scrollTo, setScrollTo] = useState('')

  useLoad((options) => {
    setGroupId(options?.groupId || '')
  })

  useEffect(() => {
    if (!groupId) return
    let stopped = false
    let first = true

    const load = async () => {
      try {
        if (first) {
          const sessions = await callFunction<ChatSession[]>('getChatList')
          if (stopped) return
          setSession(sessions.find((s) => s.groupId === groupId) || null)
          first = false
        }
        const msgs = await callFunction<ChatMessage[]>('getChatMessages', { groupId })
        if (stopped) return
        const normalized = (msgs || []).map((m) => ({
          ...m,
          id: (m as ChatMessage & { _id?: string }).id || (m as ChatMessage & { _id?: string })._id || '',
          createTime: normalizeTime(m.createTime as unknown as number | string)
        }))
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]))
          normalized.forEach((m) => map.set(m.id, m))
          return Array.from(map.values()).sort((a, b) => a.createTime - b.createTime)
        })
      } catch (err) {
        console.error('[ChatDetail] load failed:', err)
      }
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [groupId])

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1]
      setScrollTo(`msg-${last.id}`)
    }
  }, [messages.length])

  const isActive = session?.status === 'active'
  const peers = session?.members.filter((m) => m.openid !== user?.openid) || []

  const send = async (type: MessageType, content: string) => {
    const c = content.trim()
    if (!c || sending) return
    setSending(true)
    try {
      const msg = await callFunction<ChatMessage>('sendMessage', { groupId, type, content: c })
      setMessages((prev) => [...prev, { ...msg, id: msg.id || `local_${Date.now()}` }])
      setText('')
      setShowQuick(false)
    } catch (err) {
      console.error('[ChatDetail] send failed:', err)
      Taro.showToast({ title: (err as Error).message || '发送失败', icon: 'none' })
    } finally {
      setSending(false)
    }
  }

  const chooseImage = async () => {
    try {
      const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] })
      const tempPath = res.tempFiles[0].tempFilePath
      Taro.showLoading({ title: '发送中…' })
      const content = await uploadImage(tempPath)
      await callFunction('sendMessage', { groupId, type: 'image', content })
      Taro.hideLoading()
    } catch (err) {
      Taro.hideLoading()
      console.error('[ChatDetail] choose image failed:', err)
    }
  }

  const handleWecom = () => {
    const peer = peers[0]
    Taro.showModal({
      title: '企业微信核验身份',
      content: peer
        ? `请在企业微信中搜索「${peer.realName || peer.nickName}」并发起对话，确认对方为本校同学后再同行。`
        : '请在企业微信中搜索同行同学的真实姓名并发起对话，确认其为本校同学。',
      showCancel: false,
      confirmColor: '#1e6fff'
    })
  }

  const handleReport = () => {
    if (!peers[0]) return
    Taro.navigateTo({
      url: `/pages/report/index?groupId=${groupId}&reportedOpenid=${peers[0].openid}&reportedName=${encodeURIComponent(
        peers[0].realName || peers[0].nickName
      )}`
    })
  }

  const handleFinish = () => {
    Taro.showModal({
      title: '确认完成本次拼车？',
      content: '完成后可对同行同学进行评价，信用分 +1；临时群聊记录将为你保留。',
      confirmText: '完成拼车',
      confirmColor: '#00b42a',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await callFunction('completeRide', { groupId })
          setSession((prev) => (prev ? { ...prev, status: 'completed' } : prev))
          Taro.showModal({
            title: '拼车完成，感谢同行！',
            content: '现在去给同行的同学做个评价吧～',
            confirmText: '去评价',
            cancelText: '稍后',
            confirmColor: '#1e6fff',
            success: (r) => {
              if (r.confirm && peers[0]) {
                Taro.redirectTo({
                  url: `/pages/review/index?groupId=${groupId}&toOpenid=${peers[0].openid}&toName=${encodeURIComponent(
                    peers[0].realName || peers[0].nickName
                  )}`
                })
              } else {
                Taro.navigateBack()
              }
            }
          })
        } catch (err) {
          console.error('[ChatDetail] finish failed:', err)
          Taro.showToast({ title: (err as Error).message || '操作失败，请重试', icon: 'none' })
        }
      }
    })
  }

  const handleLeave = () => {
    Taro.showModal({
      title: '确认退出本次拼车？',
      content: '协商阶段退出将扣除 5 点信用分，临时聊天将关闭。',
      confirmText: '确认退出',
      cancelText: '再想想',
      confirmColor: '#f53f3f',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const data = await callFunction<{ creditDelta: number }>('leaveGroup', { groupId })
          setSession((prev) => (prev ? { ...prev, status: 'canceled' } : prev))
          Taro.showToast({ title: `已退出，信用分 ${data.creditDelta}`, icon: 'none' })
          setTimeout(() => Taro.navigateBack(), 1200)
        } catch (err) {
          console.error('[ChatDetail] leave failed:', err)
          Taro.showToast({ title: (err as Error).message || '操作失败，请重试', icon: 'none' })
        }
      }
    })
  }

  const previewImage = (url: string) => {
    Taro.previewImage({ urls: [url], current: url })
  }

  return (
    <View className={styles.page}>
      {/* 群信息头 */}
      <View className={styles.groupHeader}>
        <View className={styles.groupTitleRow}>
          <Text className={styles.groupTitle}>
            {session ? `${session.stationName} · ${session.exitName}` : '拼车群'}
          </Text>
          {session && <RouteTag direction={session.direction} />}
          <Text
            className={classnames(
              styles.groupStatus,
              session?.status === 'active' && styles.active,
              session?.status === 'completed' && styles.completed,
              session?.status === 'canceled' && styles.canceled
            )}
          >
            {session?.status === 'active'
              ? `进行中 ${session.memberCount}/${session.targetSize}`
              : session?.status === 'completed'
                ? '已完成'
                : session?.status === 'canceled'
                  ? '已取消'
                  : ''}
          </Text>
        </View>
        <View className={styles.memberRow}>
          <ScrollView scrollX className={styles.memberScroll} enhanced showScrollbar={false}>
            {session?.members.map((m) => (
              <View key={m.openid} className={styles.memberChip}>
                <Image className={styles.memberAvatar} src={m.avatar} />
                <Text className={styles.memberName}>
                  {m.openid === user?.openid ? '我' : m.realName || m.nickName}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View className={styles.headerActions}>
            <Button className={`${styles.headerBtn} ${styles.wecom}`} onClick={handleWecom}>
              企微联系
            </Button>
            <Button className={`${styles.headerBtn} ${styles.report}`} onClick={handleReport}>
              举报
            </Button>
          </View>
        </View>
      </View>

      {/* 消息列表 */}
      <ScrollView
        scrollY
        className={styles.msgScroll}
        scrollIntoView={scrollTo}
        scrollWithAnimation
      >
        {messages.map((m) => {
          if (m.type === 'system') {
            return (
              <View key={m.id} className={styles.sysMsg}>
                <Text className={styles.sysText}>{m.content}</Text>
              </View>
            )
          }
          const isSelf = m.fromOpenid === user?.openid
          return (
            <View key={m.id} id={`msg-${m.id}`} className={classnames(styles.msgRow, isSelf && styles.self)}>
              <Image className={styles.msgAvatar} src={m.avatar || user?.avatar || ''} />
              <View className={styles.msgBody}>
                <Text className={classnames(styles.msgName, isSelf && styles.self)}>
                  {isSelf ? '我' : m.fromName}
                </Text>
                {m.type === 'image' ? (
                  <Image className={styles.msgImage} src={m.content} mode="aspectFill" onClick={() => previewImage(m.content)} />
                ) : (
                  <Text
                    className={classnames(
                      styles.bubble,
                      isSelf ? styles.bubbleSelf : styles.bubbleOther,
                      m.type === 'quick' && !isSelf && styles.bubbleQuick
                    )}
                  >
                    {m.type === 'quick' && !isSelf && <Text className={styles.quickTag}>— 快捷常用语 —</Text>}
                    {m.content}
                  </Text>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>

      {isActive && showQuick && (
        <View className={styles.quickPanel}>
          {QUICK_PHRASES.map((p) => (
            <View key={p} className={styles.quickChip} onClick={() => send('quick', p)}>
              {p}
            </View>
          ))}
        </View>
      )}

      {isActive ? (
        <>
          <View className={styles.inputBar}>
            <Button className={styles.iconBtn} onClick={chooseImage}>
              ＋
            </Button>
            <Button
              className={styles.iconBtn}
              onClick={() => setShowQuick((v) => !v)}
            >
              ☰
            </Button>
            <Input
              className={styles.msgInput}
              placeholder="和同行同学说点什么…"
              value={text}
              onInput={(e) => setText(e.detail.value)}
              onConfirm={() => send('text', text)}
              confirmType="send"
            />
            <Button
              className={classnames(styles.sendBtn, !text.trim() && styles.sendBtnDisabled)}
              onClick={() => send('text', text)}
              loading={sending}
            >
              发送
            </Button>
          </View>
          <View className={styles.actionBar}>
            <Button className={`${styles.actionBtn} ${styles.actionLeave}`} onClick={handleLeave}>
              退出拼车（扣分）
            </Button>
            <Button className={`${styles.actionBtn} ${styles.actionFinish}`} onClick={handleFinish}>
              完成拼车
            </Button>
          </View>
        </>
      ) : (
        <View className={styles.endedBar}>
          {session?.status === 'completed'
            ? '本次拼车已完成 · 感谢同行，可在「行程」中查看记录与评价'
            : '本次拼车已取消 · 临时聊天关闭'}
        </View>
      )}
    </View>
  )
}
