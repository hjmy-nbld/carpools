/**
 * 登录 / 注册页面
 *
 * 填写真实姓名（头像昵称选填）完成注册登录，并提供 3 个测试账号一键登录用于快速体验。
 */
import { useState } from 'react'
import { View, Text, Image, Button, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import { API_ENABLED, TEST_ACCOUNTS } from '@/config'
import type { UserInfo } from '@/types'
import styles from './index.module.scss'

const DEFAULT_AVATAR = 'https://picsum.photos/id/64/200/200'

export default function LoginPage() {
  const { user, init, setUser } = useUserStore()
  const [nickName, setNickName] = useState('')
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR)
  const [realName, setRealName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [testLoading, setTestLoading] = useState('')

  useDidShow(() => {
    init()
    if (user) {
      setNickName(user.nickName === '微信用户' ? '' : user.nickName)
      setAvatar(user.avatar || DEFAULT_AVATAR)
      setRealName(user.realName || '')
    }
  })

  // 微信端走头像昵称填写能力；H5 点击时降级选择本地图片
  const onChooseAvatar = async (e: { detail?: { avatarUrl?: string } }) => {
    if (e.detail?.avatarUrl) {
      setAvatar(e.detail.avatarUrl)
      return
    }
    try {
      const res = await Taro.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'] })
      setAvatar(res.tempFiles[0].tempFilePath)
    } catch (err) {
      console.error('[Login] choose avatar failed:', err)
    }
  }

  const handleSubmit = async () => {
    if (!realName.trim()) {
      Taro.showToast({ title: '请填写真实姓名', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const u = await callFunction<UserInfo>('login', {
        realName: realName.trim(),
        nickName: nickName.trim(),
        avatar
      })
      setUser(u)
      Taro.showToast({ title: `欢迎，${u.realName}`, icon: 'success' })
      setTimeout(() => {
        if (Taro.getCurrentPages().length > 1) {
          Taro.navigateBack()
        } else {
          Taro.switchTab({ url: '/pages/home/index' })
        }
      }, 700)
    } catch (err) {
      console.error('[Login] submit failed:', err)
      Taro.showToast({ title: (err as Error).message || '登录失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestLogin = async (key: string) => {
    if (testLoading) return
    Taro.showToast({ title: '正在登录…', icon: 'loading', duration: 8000 })
    setTestLoading(key)
    try {
      const u = await callFunction<UserInfo>('login', { testAccount: key })
      setUser(u)
      Taro.showToast({ title: `欢迎，${u.realName}`, icon: 'success' })
      setTimeout(() => {
        if (Taro.getCurrentPages().length > 1) {
          Taro.navigateBack()
        } else {
          Taro.switchTab({ url: '/pages/home/index' })
        }
      }, 700)
    } catch (err) {
      console.error('[Login] test account login failed:', err)
      Taro.showToast({ title: (err as Error).message || '登录失败，请确认后端已启动', icon: 'none' })
    } finally {
      setTestLoading('')
    }
  }

  const canSubmit = !!realName.trim()
  const isRegistered = !!user?.realName

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.heroIcon}>
          <Text className={styles.heroIconText}>同</Text>
        </View>
        <Text className={styles.heroTitle}>欢迎使用同路人</Text>
        <Text className={styles.heroSub}>填写真实姓名即可开始拼车</Text>
      </View>

      {API_ENABLED && (
        <View className={styles.testCard}>
          <View className={styles.testHead}>
            <Text className={styles.testBadge}>快速体验</Text>
            <Text className={styles.testTitle}>测试账号一键登录</Text>
          </View>
          <Text className={styles.testTip}>
            一键切换预设身份，可直接体验拼车、匹配、群聊、评价、举报全部功能。
          </Text>
          {TEST_ACCOUNTS.map((acc) => (
            <Button
              key={acc.key}
              className={styles.testItem}
              onClick={() => handleTestLogin(acc.key)}
            >
              <Text className={styles.testItemName}>{acc.label} · {acc.realName}</Text>
              <Text className={styles.testItemDesc}>{acc.desc}</Text>
              <Text className={styles.testItemGo}>
                {testLoading === acc.key ? '登录中…' : '登录 ›'}
              </Text>
            </Button>
          ))}
        </View>
      )}

      {/* 头像昵称（选填） */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>1</View>
          <Text className={styles.stepName}>头像与昵称（选填）</Text>
        </View>
        <View className={styles.avatarRow}>
          <Button
            className={styles.avatarPick}
            openType="chooseAvatar"
            onChooseAvatar={onChooseAvatar}
            onClick={() => {
              if (process.env.TARO_ENV !== 'weapp') onChooseAvatar({})
            }}
            style={{ padding: 0, background: 'transparent', lineHeight: 'normal' }}
          >
            <Image className={styles.avatarImg} src={avatar} mode="aspectFill" />
            <Text className={styles.avatarEdit}>更换</Text>
          </Button>
          <Text className={styles.avatarTip}>点击头像可使用微信头像或上传照片，昵称将在临时群聊中展示。</Text>
        </View>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>微信昵称</Text>
          <Input
            className={styles.formInput}
            type={'nickname' as 'text'}
            placeholder="选填，默认展示真实姓名"
            value={nickName}
            onInput={(e) => setNickName(e.detail.value)}
            maxlength={20}
          />
        </View>
      </View>

      {/* 真实姓名（注册必填） */}
      <View className={styles.card}>
        <View className={styles.stepTitle}>
          <View className={styles.stepNo}>2</View>
          <Text className={styles.stepName}>真实姓名</Text>
        </View>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>真实姓名</Text>
          <Input
            className={styles.formInput}
            placeholder="请填写真实姓名"
            value={realName}
            onInput={(e) => setRealName(e.detail.value)}
            maxlength={10}
          />
        </View>
        <Text className={styles.demoCodeTip}>
          身份核验提示：平台不做线上实名认证，请自行在企业微信中搜索同学的真实姓名并发起对话，确认其为本校同学后再同行。
        </Text>
      </View>

      <Text className={styles.notice}>
        真实姓名仅在匹配成功后向同行同学展示，不会用于其他用途。
      </Text>

      <View className={styles.footer}>
        <Button
          className={classnames(styles.submitBtn, !canSubmit && styles.submitBtnDisabled)}
          loading={submitting}
          onClick={handleSubmit}
        >
          {isRegistered ? '保存并返回' : '完成注册'}
        </Button>
      </View>
    </View>
  )
}
