/**
 * 个人中心页面
 *
 * tabBar 我的页，展示用户资料、信用分与完成拼车次数，提供默认信息、真实姓名、规则等入口。
 */
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useUserStore } from '@/store/useUserStore'
import { isLoggedIn } from '@/services/cloud'
import styles from './index.module.scss'

function creditLevel(score: number): string {
  if (score >= 95) return '信用优秀'
  if (score >= 90) return '信用良好'
  if (score >= 80) return '信用一般'
  return '需要改进'
}

export default function MinePage() {
  const { user, init, refresh } = useUserStore()

  useDidShow(() => {
    init()
      .then(() => {
        // 未选择测试账号时不调用需登录的资料接口
        if (isLoggedIn()) return refresh()
      })
      .catch((err) => console.error('[Mine] refresh failed:', err))
  })

  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const goDefaultInfo = () => {
    if (!user?.realName) {
      Taro.showToast({ title: '请先填写真实姓名', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/default-info/index' })
  }

  const showRules = () => {
    Taro.showModal({
      title: '信用与安全规则',
      content:
        '1. 完成一次拼车信用分 +1；协商阶段恶意退出信用分 -5。\n2. 被核实恶意毁约、语言攻击、虚假身份，将视情节被警告、限制匹配或封禁。\n3. 平台不做线上强制实名：请自行在企业微信中搜索同行同学的真实姓名并对话核验；拼车全程使用临时群聊，无需交换私人联系方式。',
      showCancel: false,
      confirmColor: '#1e6fff'
    })
  }

  const showHelp = () => {
    Taro.showModal({
      title: '帮助与反馈',
      content: '如遇到匹配问题、账号异常或对产品的建议，可通过学校企业微信「同路人反馈群」联系我们，我们会在 24 小时内响应。',
      showCancel: false,
      confirmColor: '#1e6fff'
    })
  }

  const showAbout = () => {
    Taro.showModal({
      title: '关于同路人',
      content: '同路人 · 校园即时拼车 v1.0\n面向固定路线（地铁站 ↔ 学校）场景的校园拼车匹配工具，让同校同学分摊费用、安全同行。',
      showCancel: false,
      confirmColor: '#1e6fff'
    })
  }

  return (
    <View className={styles.page}>
      {/* 用户卡 */}
      <View className={styles.userCard} onClick={user?.realName ? undefined : goLogin}>
        <Image className={styles.avatar} src={user?.avatar || 'https://picsum.photos/id/64/200/200'} />
        <View className={styles.userInfo}>
          <View className={styles.nickName}>
            <Text>{user?.nickName || '未登录'}</Text>
            <Text className={`${styles.verifyBadge} ${user?.realName ? styles.done : styles.todo}`}>
              {user?.realName ? `✓ ${user.realName}` : '去填写姓名 ›'}
            </Text>
          </View>
          <Text className={styles.schoolText}>{user?.school || '北京化工大学（昌平校区）'}</Text>
        </View>
        {!user?.realName && <Text className={styles.arrowWhite}>›</Text>}
      </View>

      {/* 信用分 */}
      <View className={styles.creditCard}>
        <View className={styles.creditMain}>
          <Text className={styles.creditLabel}>我的信用分</Text>
          <View>
            <Text className={styles.creditScore}>{user?.creditScore ?? 100}</Text>
            <Text className={styles.creditLevel}>{creditLevel(user?.creditScore ?? 100)}</Text>
          </View>
        </View>
        <View className={styles.creditStats}>
          <Text className={styles.statNum}>{user?.finishedCount ?? 0}</Text>
          <Text className={styles.statLabel}>完成拼车（次）</Text>
        </View>
      </View>

      {/* 菜单 */}
      <View className={styles.menuCard}>
        <View className={styles.menuItem} onClick={goDefaultInfo}>
          <View className={`${styles.menuIcon} ${styles.iconBlue}`}>
            <Text>◎</Text>
          </View>
          <Text className={styles.menuLabel}>默认拼车信息</Text>
          <Text className={styles.menuValue}>自动填充</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>

        <View className={styles.menuItem} onClick={goLogin}>
          <View className={`${styles.menuIcon} ${styles.iconCyan}`}>
            <Text>✓</Text>
          </View>
          <Text className={styles.menuLabel}>真实姓名</Text>
          <Text className={styles.menuValue}>{user?.realName || '未填写'}</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>

        <View className={styles.menuItem} onClick={showRules}>
          <View className={`${styles.menuIcon} ${styles.iconOrange}`}>
            <Text>!</Text>
          </View>
          <Text className={styles.menuLabel}>信用与安全规则</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>

        <View className={styles.menuItem} onClick={showHelp}>
          <View className={`${styles.menuIcon} ${styles.iconGray}`}>
            <Text>?</Text>
          </View>
          <Text className={styles.menuLabel}>帮助与反馈</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>

        <View className={styles.menuItem} onClick={showAbout}>
          <View className={`${styles.menuIcon} ${styles.iconGray}`}>
            <Text>i</Text>
          </View>
          <Text className={styles.menuLabel}>关于同路人</Text>
          <Text className={styles.menuValue}>v1.0</Text>
          <Text className={styles.menuArrow}>›</Text>
        </View>
      </View>
    </View>
  )
}
