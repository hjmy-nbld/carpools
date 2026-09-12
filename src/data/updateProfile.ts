/**
 * H5 Mock：更新个人资料。将传入的 patch 浅合并到当前用户档案并持久化返回。
 */
import { getDB, saveDB } from './_store'
import type { UserInfo } from '@/types'

interface UpdateProfileEvent {
  patch: Partial<UserInfo>
}

export default async function updateProfile(
  event: UpdateProfileEvent
): Promise<UserInfo> {
  const db = getDB()
  if (!db.user) throw new Error('用户不存在')
  db.user = { ...db.user, ...event.patch }
  saveDB(db)
  console.info('[MockUpdateProfile] patched:', Object.keys(event.patch || {}).join(','))
  return db.user
}
