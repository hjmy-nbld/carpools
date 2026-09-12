/**
 * H5 Mock：登录。首次进入时创建默认用户档案并持久化，之后直接返回当前用户。
 */
import { getDB, saveDB, SELF_OPENID } from './_store'
import type { UserInfo } from '@/types'

export default async function login(): Promise<UserInfo> {
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
    console.info('[MockLogin] new user created')
  }
  return db.user
}
