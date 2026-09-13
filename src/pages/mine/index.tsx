/**
 * 个人中心页面
 *
 * tabBar 我的页，展示用户资料、信用分与完成拼车次数，提供默认信息、真实姓名、规则等入口。
 */
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import dayjs from 'dayjs'
import { useUserStore } from '@/store/useUserStore'
import { isLoggedIn } from '@/services/cloud'
import { creditLevel, freezeRemainMs, formatRemain } from '@/utils/credit'
import { CREDIT_DELETE_SCORE, CREDIT_FREEZE_DAYS, CREDIT_FREEZE_SCORE, CREDIT_WARN_SCORE } from '@/config'
import styles from './index.module.scss'

export default function MinePage() {
  const { user, init, refresh, logout } = useUserStore()

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
        '1. 信用分初始 100、上限 100：完成一次拼车 +1（每天最多加 2 次，两次间隔至少 3 小时，防止刷分）；协商阶段中途退出 -5，且 2 分钟内无法再次匹配。\n2. 信用分低于 85 分将被警告；低于 75 分冻结账号 30 天（冻结期内无法发起拼车，到期自动解冻）；低于 70 分账号将被注销。\n3. 被核实恶意毁约、语言攻击、虚假身份，将视情节从严处置。\n4. 平台不做线上强制实名：请自行在企业微信中搜索同行同学的真实姓名并对话核验；拼车全程使用临时群聊，无需交换私人联系方式。',
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

  // 退出登录：二次确认后清除本地令牌与缓存用户，并跳转登录页
  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新登录才能使用拼车功能，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#fa5151',
      success: (res) => {
        if (!res.confirm) return
        logout()
        Taro.showToast({ title: '已退出登录', icon: 'success' })
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages/login/index' })
        }, 600)
      }
    })
  }

  const frozenMs = freezeRemainMs(user)
  const showWarn = !!user && user.status !== 'frozen' && user.creditScore < CREDIT_WARN_SCORE

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

      {/* 冻结提示 */}
      {user?.status === 'frozen' && frozenMs > 0 && (
        <View className={`${styles.noticeCard} ${styles.noticeFrozen}`}>
          <Text className={styles.noticeTitle}>账号冻结中</Text>
          <Text className={styles.noticeText}>
            信用分低于 {CREDIT_FREEZE_SCORE} 分，账号已冻结 {CREDIT_FREEZE_DAYS} 天，剩余
            {formatRemain(frozenMs)}自动解冻（约 {dayjs(user.frozenUntil || 0).format('MM-DD HH:mm')}）。
            冻结期内无法发起拼车，到期后请通过完成行程恢复信用。
          </Text>
        </View>
      )}

      {/* 信用预警 */}
      {showWarn && user.status !== 'frozen' && (
        <View className={`${styles.noticeCard} ${styles.noticeWarn}`}>
          <Text className={styles.noticeTitle}>信用预警</Text>
          <Text className={styles.noticeText}>
            当前信用分 {user.creditScore}，低于 85 分已被警告；低于 {CREDIT_FREEZE_SCORE} 分将冻结
            {CREDIT_FREEZE_DAYS} 天，低于 {CREDIT_DELETE_SCORE} 分将注销账号，请珍惜信用。
          </Text>
        </View>
      )}

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

      {/* 退出登录（仅已登录时展示） */}
      {isLoggedIn() && (
        <View className={styles.logoutCard}>
          <View className={styles.logoutBtn} onClick={handleLogout}>
            <Text>退出登录</Text>
          </View>
        </View>
      )}
    </View>
  )
}
