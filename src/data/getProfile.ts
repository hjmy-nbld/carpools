/**
 * H5 Mock：获取当前用户资料。资料不存在时创建默认 Mock 用户并持久化后返回。
 */
import { getDB, saveDB, SELF_OPENID } from './_store'
import type { UserInfo } from '@/types'

export default async function getProfile(): Promise<UserInfo> {
  const db = getDB()
  if (!db.user) {
    db.user = {
      openid: SELF_OPENID,
      nickName: '微信用户',
      avatar: 'https://picsum.photos/id/64/200/200',
      realName: '',
      school: '北京化工大学（昌平校区）',
      creditScore: 100,
      status: 'normal',
      finishedCount: 0,
      createTime: Date.now()
    }
    saveDB(db)
  }
  return db.user
}
