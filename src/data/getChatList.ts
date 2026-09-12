/**
 * H5 Mock：获取消息会话列表。由我所在的拼车组与聊天记录汇总最后一条消息，按时间倒序返回。
 */
import { getDB, SELF_OPENID } from './_store'
import type { ChatSession } from '@/types'

export default async function getChatList(): Promise<ChatSession[]> {
  const db = getDB()
  const sessions: ChatSession[] = db.groups
    .filter((g) => g.members.some((m) => m.openid === SELF_OPENID))
    .map((g) => {
      const msgs = db.messages
        .filter((m) => m.groupId === g.id && m.type !== 'system')
        .sort((a, b) => a.createTime - b.createTime)
      const last = msgs[msgs.length - 1]
      return {
        groupId: g.id,
        direction: g.direction,
        stationName: g.stationName,
        exitName: g.exitName,
        targetSize: g.targetSize,
        memberCount: g.members.length,
        members: g.members,
        status: g.status,
        lastMessage: last
          ? last.type === 'image'
            ? '[图片]'
            : last.content
          : '拼车小组已建立，来打个招呼吧',
        lastTime: last ? last.createTime : g.createTime,
        unread: 0
      }
    })
    .sort((a, b) => b.lastTime - a.lastTime)
  return sessions
}
