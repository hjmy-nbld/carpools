/**
 * H5 Mock：获取指定拼车组的聊天消息，按发送时间升序返回。
 */
import { getDB } from './_store'
import type { ChatMessage } from '@/types'

interface GetMessagesEvent {
  groupId: string
}

export default async function getChatMessages(
  event: GetMessagesEvent
): Promise<ChatMessage[]> {
  const db = getDB()
  return db.messages
    .filter((m) => m.groupId === event.groupId)
    .sort((a, b) => a.createTime - b.createTime)
}
