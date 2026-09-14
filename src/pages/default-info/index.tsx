/**
 * 默认辨认信息页面
 *
 * 设置常用的等候位置、服装 / 外貌描述与默认辨认照片，保存后下次发起拼车时自动填充。
 */
import { useEffect, useState } from 'react'
import { View, Text, Input, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { callFunction, uploadImage } from '@/services/cloud'
import { useUserStore } from '@/store/useUserStore'
import type { UserInfo } from '@/types'
import styles from './index.module.scss'

export default function DefaultInfoPage() {
  const { user, setUser, init } = useUserStore()
  const [waitLocation, setWaitLocation] = useState('')
  const [outfit, setOutfit] = useState('')
  const [photo, setPhoto] = useState('')
  const [saving, setSaving] = useState(false)

  useDidShow(() => {
    init()
  })

  useEffect(() => {
    if (user) {
      setWaitLocation(user.defaultWaitLocation || '')
      setOutfit(user.defaultOutfit || '')
      setPhoto(user.defaultPhoto || '')
    }
  }, [user])

  const choosePhoto = async () => {
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const tempPath = res.tempFiles[0].tempFilePath
      setPhoto(await uploadImage(tempPath))
    } catch (err) {
      console.error('[DefaultInfo] choose photo failed:', err)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const patch: Partial<UserInfo> = {
        defaultWaitLocation: waitLocation.trim(),
        defaultOutfit: outfit.trim(),
        defaultPhoto: photo
      }
      const updated = await callFunction<UserInfo>('updateProfile', { patch })
      setUser(updated)
      Taro.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 700)
    } catch (err) {
      console.error('[DefaultInfo] save failed:', err)
      Taro.showToast({ title: (err as Error).message || '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={styles.page}>
      <Text className={styles.tip}>
        设置后，每次发起拼车时将自动填充以下信息，减少重复输入；照片仅在匹配成功后向同行同学展示。
      </Text>

      <View className={styles.card}>
        <View className={styles.formItem}>
          <Text className={styles.formLabel}>默认等候位置</Text>
          <Input
            className={styles.formInput}
            placeholder="如：马路边"
            value={waitLocation}
            onInput={(e) => setWaitLocation(e.detail.value)}
            maxlength={40}
          />
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>默认服装 / 外貌描述</Text>
          <Input
            className={styles.formInput}
            placeholder="如：黑色外套、蓝色牛仔裤、背黑色书包"
            value={outfit}
            onInput={(e) => setOutfit(e.detail.value)}
            maxlength={50}
          />
        </View>

        <View className={styles.formItem}>
          <Text className={styles.formLabel}>默认辨认照片</Text>
          <View className={styles.photoRow}>
            {photo ? (
              <View className={styles.photoBox}>
                <Image className={styles.photoImg} src={photo} mode="aspectFill" onClick={choosePhoto} />
              </View>
            ) : (
              <View className={styles.photoAdd} onClick={choosePhoto}>
                <Text className={styles.plus}>+</Text>
                <Text className={styles.addText}>上传照片</Text>
              </View>
            )}
            <Text className={styles.photoTip}>建议使用清晰的生活照或现场照片，便于同行同学线下快速辨认。</Text>
          </View>
        </View>
      </View>

      <View className={styles.footer}>
        <Button className={styles.saveBtn} loading={saving} onClick={handleSave}>
          保存默认信息
        </Button>
      </View>
    </View>
  )
}
