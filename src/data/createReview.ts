/**
 * H5 Mock：提交同行评价。将评分、标签与评论以当前用户为提交人写入评价记录。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'

interface CreateReviewEvent {
  groupId: string
  toOpenid: string
  score: number
  tags: string[]
  comment: string
}

export default async function createReview(
  event: CreateReviewEvent
): Promise<{ success: boolean }> {
  const db = getDB()
  db.reviews.push({
    id: genId('review'),
    groupId: event.groupId,
    fromOpenid: SELF_OPENID,
    toOpenid: event.toOpenid,
    score: event.score,
    tags: event.tags,
    comment: event.comment,
    createTime: Date.now()
  })
  saveDB(db)
  console.info('[MockCreateReview] score:', event.score, 'tags:', event.tags.join('/'))
  return { success: true }
}
