/**
 * 举报页面
 *
 * 选择举报原因（单选）、填写情况描述并上传最多 3 张图片证据，提交后由管理员匿名核实处理。
 */
import { useState } from 'react'
import { View, Text, Textarea, Button, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction, uploadImage } from '@/services/cloud'
import styles from './index.module.scss'

const REASONS = [
  { value: '恶意毁约', hint: '无故爽约、恶意退出' },
  { value: '语言攻击', hint: '辱骂、骚扰、不文明用语' },
  { value: '虚假身份', hint: '非本校人员或冒用他人身份' },
  { value: '私下交易骚扰', hint: '诱导脱离平台、索要财物' },
  { value: '其他违规行为', hint: '其他影响拼车安全的行为' }
]

const MAX_IMAGES = 3

export default function ReportPage() {
  const [groupId, setGroupId] = useState('')
  const [reportedOpenid, setReportedOpenid] = useState('')
  const [reportedName, setReportedName] = useState('该用户')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useLoad((options) => {
    setGroupId(options?.groupId || '')
    setReportedOpenid(options?.reportedOpenid || '')
    if (options?.reportedName) setReportedName(decodeURIComponent(options.reportedName))
  })

  const chooseImages = async () => {
    if (images.length >= MAX_IMAGES) return
    try {
      const res = await Taro.chooseMedia({
        count: MAX_IMAGES - images.length,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const paths: string[] = []
      for (const file of res.tempFiles) {
        try {
          paths.push(await uploadImage(file.tempFilePath))
        } catch (upErr) {
          console.error('[Report] upload failed:', upErr)
        }
      }
      setImages((prev) => [...prev, ...paths].slice(0, MAX_IMAGES))
    } catch (err) {
      console.error('[Report] choose images failed:', err)
    }
  }

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    if (!reason) {
      Taro.showToast({ title: '请选择举报原因', icon: 'none' })
      return
    }
    if (!groupId || !reportedOpenid) {
      Taro.showToast({ title: '举报信息缺失', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      await callFunction('createReport', {
        groupId,
        reportedOpenid,
        reason,
        images,
        description: description.trim()
      })
      Taro.showModal({
        title: '举报已提交',
        content: '管理员会在 24 小时内核实处理，核实后将视情节对该用户进行警告、限制匹配或封禁。感谢你共同维护安全的拼车环境。',
        showCancel: false,
        confirmColor: '#1e6fff',
        success: () => Taro.navigateBack()
      })
    } catch (err) {
      console.error('[Report] submit failed:', err)
      Taro.showToast({ title: (err as Error).message || '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = !!reason

  return (
    <View className={styles.page}>
      <View className={styles.targetCard}>
        <View className={styles.targetIcon}>
          <Text>!</Text>
        </View>
        <View>
          <Text className={styles.targetName}>被举报人：{reportedName}</Text>
          <Text className={styles.targetSub}>举报将由管理员匿名核实，恶意举报将影响你的信用分</Text>
        </View>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>举报原因（单选）</Text>
        <View className={styles.reasonList}>
          {REASONS.map((r) => (
            <View
              key={r.value}
              className={classnames(styles.reasonItem, reason === r.value && styles.reasonItemActive)}
              onClick={() => setReason(r.value)}
            >
              <View className={classnames(styles.radio, reason === r.value && styles.radioActive)} />
              <Text className={styles.reasonText}>{r.value}</Text>
              <Text className={styles.reasonHint}>{r.hint}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>情况描述（选填）</Text>
        <Textarea
          className={styles.textarea}
          placeholder="请描述事情经过，包括时间、地点、具体行为等，越具体越有助于我们核实处理…"
          value={description}
          maxlength={300}
          onInput={(e) => setDescription(e.detail.value)}
        />
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>上传证据（{images.length}/{MAX_IMAGES}，选填）</Text>
        <View className={styles.evidenceRow}>
          {images.map((img, idx) => (
            <View key={idx} className={styles.evidenceBox}>
              <Image className={styles.evidenceImg} src={img} mode="aspectFill" />
              <View className={styles.evidenceRemove} onClick={() => removeImage(idx)}>
                ✕
              </View>
            </View>
          ))}
          {images.length < MAX_IMAGES && (
            <View className={styles.evidenceAdd} onClick={chooseImages}>
              <Text className={styles.plus}>+</Text>
              <Text className={styles.addText}>添加截图/照片</Text>
            </View>
          )}
        </View>
      </View>

      <Text className={styles.notice}>
        我们承诺保护举报人信息，不会向被举报人透露你的身份。请确保举报内容真实，恶意举报将被扣除信用分并限制使用。
      </Text>

      <View className={styles.footer}>
        <Button
          className={classnames(styles.submitBtn, !canSubmit && styles.submitBtnDisabled)}
          loading={submitting}
          onClick={handleSubmit}
        >
          提交举报
        </Button>
      </View>
    </View>
  )
}
