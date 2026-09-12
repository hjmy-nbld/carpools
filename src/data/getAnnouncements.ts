/**
 * H5 Mock：获取首页公告。返回两条写死的安全提示与匹配高峰提示文案。
 */
import type { Announcement } from '@/types'

export default async function getAnnouncements(): Promise<Announcement[]> {
  return [
    {
      id: 'ann_1',
      title: '安全提示',
      content: '平台不做线上强制实名：请在企业微信中自行搜索同行同学的真实姓名并对话核验；全程临时群聊沟通，勿提前私下交易。'
    },
    {
      id: 'ann_2',
      title: '匹配高峰',
      content: '工作日 17:30-19:00 为返程高峰，平均 30 秒即可拼成，建议提前到岗。'
    }
  ]
}
