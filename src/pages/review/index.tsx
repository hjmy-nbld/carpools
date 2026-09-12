/**
 * 行程评价页面
 *
 * 拼车完成后对同行同学进行匿名评价：选择 1-5 星评分，按分数展示好评 / 差评标签，
 * 可补充文字评价后提交。
 */
import { useMemo, useState } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import classnames from 'classnames'
import { callFunction } from '@/services/cloud'
import styles from './index.module.scss'

const GOOD_TAGS = ['准时到达', '沟通顺畅', '着装描述准确', '友善可靠', '车内整洁', '主动分摊费用']
const BAD_TAGS = ['不准时', '沟通困难', '着装描述不符', '临时爽约', '语言不文明', '费用争议']

const SCORE_TEXT = ['', '很不满意', '不太满意', '一般', '比较满意', '非常满意']

export default function ReviewPage() {
  const [groupId, setGroupId] = useState('')
  const [toOpenid, setToOpenid] = useState('')
  const [toName, setToName] = useState('同行同学')
  const [score, setScore] = useState(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad((options) => {
    setGroupId(options?.groupId || '')
    setToOpenid(options?.toOpenid || '')
    if (options?.toName) setToName(decodeURIComponent(options.toName))
  })

  const tagOptions = useMemo(() => {
    if (score > 0 && score <= 3) return BAD_TAGS
    return GOOD_TAGS
  }, [score])

  const chooseScore = (n: number) => {
    setScore(n)
    setSelectedTags([])
  }

  const toggleTag = (t: string) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const handleSubmit = async () => {
    if (score < 1) {
      Taro.showToast({ title: '请选择星级评分', icon: 'none' })
      return
    }
    if (!groupId || !toOpenid) {
      Taro.showToast({ title: '评价信息缺失', icon: 'none' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      await callFunction('createReview', {
        groupId,
        toOpenid,
        score,
        tags: selectedTags,
        comment: comment.trim()
      })
      Taro.showToast({ title: '评价已提交', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (err) {
      console.error('[Review] submit failed:', err)
      Taro.showToast({ title: (err as Error).message || '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.targetCard}>
        <View className={styles.targetIcon}>{toName.slice(0, 1)}</View>
        <Text className={styles.targetName}>{toName}</Text>
        <Text className={styles.targetSub}>本次同行的同学，你的匿名评价将帮助大家更安全地拼车</Text>
      </View>

      <View className={styles.card}>
        <Text className={styles.cardTitle}>整体评分</Text>
        <View className={styles.starRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Text
              key={n}
              className={classnames(styles.star, n <= score && styles.starActive)}
              onClick={() => chooseScore(n)}
            >
              ★
            </Text>
          ))}
        </View>
        <Text className={styles.scoreText}>{score > 0 ? SCORE_TEXT[score] : '点击星星为本次同行打分'}</Text>
      </View>

      {score > 0 && (
        <View className={styles.card}>
          <Text className={styles.cardTitle}>{score >= 4 ? 'TA 做得好的地方' : 'TA 存在的问题'}</Text>
          <View className={styles.tagGrid}>
            {tagOptions.map((t) => (
              <View
                key={t}
                className={classnames(styles.tag, selectedTags.includes(t) && styles.tagActive)}
                onClick={() => toggleTag(t)}
              >
                {t}
              </View>
            ))}
          </View>
        </View>
      )}

      <View className={styles.card}>
        <Text className={styles.cardTitle}>补充评价（选填）</Text>
        <Textarea
          className={styles.textarea}
          placeholder="说说这次拼车的具体感受，帮助同学改进，也帮助我们更好地管理社区…"
          value={comment}
          maxlength={300}
          onInput={(e) => setComment(e.detail.value)}
        />
      </View>

      <View className={styles.footer}>
        <Button
          className={classnames(styles.submitBtn, score < 1 && styles.submitBtnDisabled)}
          loading={submitting}
          onClick={handleSubmit}
        >
          提交评价
        </Button>
      </View>
    </View>
  )
}
