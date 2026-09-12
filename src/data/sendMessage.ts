/**
 * H5 Mock：发送聊天消息。消息落库后延时 1.2 秒模拟同行同学随机自动回复一条消息。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'
import type { ChatMessage, MessageType } from '@/types'

interface SendMessageEvent {
  groupId: string
  type: MessageType
  content: string
}

const PEER_REPLIES = [
  '好嘞，我就在出口这边等你～',
  '收到，稍等我两分钟',
  '我穿黑色外套，背深色书包',
  '看到你了！我挥手示意',
  '可以的，我们就在这个位置上车',
  '我大概 3 分钟到，麻烦稍等一下'
]

export default async function sendMessage(
  event: SendMessageEvent
): Promise<ChatMessage> {
  const db = getDB()
  if (!db.user) throw new Error('用户不存在')

  const now = Date.now()
  const message: ChatMessage = {
    id: genId('msg'),
    groupId: event.groupId,
    fromOpenid: SELF_OPENID,
    fromName: '我',
    avatar: db.user.avatar,
    type: event.type,
    content: event.content,
    createTime: now
  }
  db.messages.push(message)
  saveDB(db)
  console.info('[MockSendMessage]', event.type)

  // 模拟同行同学自动回复，增强演示真实感
  setTimeout(() => {
    const latest = getDB()
    const group = latest.groups.find((g) => g.id === event.groupId)
    if (!group || group.status !== 'active') return
    const peer = group.members.find((m) => m.openid !== SELF_OPENID)
    if (!peer) return
    const reply = PEER_REPLIES[Math.floor(Math.random() * PEER_REPLIES.length)]
    latest.messages.push({
      id: genId('msg'),
      groupId: event.groupId,
      fromOpenid: peer.openid,
      fromName: peer.nickName,
      avatar: peer.avatar,
      type: 'text',
      content: event.type === 'image' ? '收到图片了，我马上过来！' : reply,
      createTime: Date.now()
    })
    saveDB(latest)
  }, 1200)

  return message
}
