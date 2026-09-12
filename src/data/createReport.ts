/**
 * H5 Mock：提交举报。生成一条 pending 状态的举报记录（理由/图片/描述）写入 Mock 数据库。
 */
import { getDB, saveDB, genId, SELF_OPENID } from './_store'

interface CreateReportEvent {
  groupId: string
  reportedOpenid: string
  reason: string
  images: string[]
  description: string
}

export default async function createReport(
  event: CreateReportEvent
): Promise<{ success: boolean; id: string }> {
  const db = getDB()
  const id = genId('report')
  db.reports.push({
    id,
    groupId: event.groupId,
    reporterOpenid: SELF_OPENID,
    reportedOpenid: event.reportedOpenid,
    reason: event.reason,
    images: event.images || [],
    description: event.description,
    status: 'pending',
    createTime: Date.now()
  })
  saveDB(db)
  console.info('[MockCreateReport] reason:', event.reason)
  return { success: true, id }
}
