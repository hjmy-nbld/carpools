// ============================================
// H5 预览专用 Mock 存储（localStorage 持久化）
// 仅在非微信环境被 services/cloud.ts 动态加载；
// 微信端编译时不会打包本目录的 mock 模块。
// ============================================
import type {
  ChatMessage,
  Direction,
  RideGroup,
  RideMember,
  RideRequest,
  Station,
  TripRecord,
  UserInfo
} from '@/types'

export const SELF_OPENID = 'mock_self_openid'

const DB_KEY = 'carpool_mock_db_v1'

/** 虚拟同学池 */
export const PEER_POOL: RideMember[] = [
  {
    openid: 'mock_peer_lxy',
    nickName: '林晓雨',
    avatar: 'https://picsum.photos/id/177/200/200',
    realName: '林晓雨',
    creditScore: 98
  },
  {
    openid: 'mock_peer_cyn',
    nickName: '陈一诺',
    avatar: 'https://picsum.photos/id/338/200/200',
    realName: '陈一诺',
    creditScore: 100
  },
  {
    openid: 'mock_peer_zzm',
    nickName: '周子墨',
    avatar: 'https://picsum.photos/id/1027/200/200',
    realName: '周子墨',
    creditScore: 95
  },
  {
    openid: 'mock_peer_wyc',
    nickName: '王宇辰',
    avatar: 'https://picsum.photos/id/91/200/200',
    realName: '王宇辰',
    creditScore: 97
  }
]

export const MOCK_STATIONS: Record<Direction, Station[]> = {
  metro2school: [
    {
      id: 'metro_xishankou',
      name: '昌平西山口站',
      toName: '北京化工大学（昌平校区）',
      type: 'subway',
      exits: [
        { id: 'exit_a', name: 'A 口', latitude: 40.244810, longitude: 116.193813, distanceToSchool: 4.5 }
      ]
    }
  ],
  school2metro: [
    {
      id: 'school_buct',
      name: '北京化工大学（昌平校区）',
      toName: '昌平西山口站',
      type: 'school',
      exits: [
        // GCJ02 坐标，现场实测取点，与 backend/seed.py 保持一致
        { id: 'gate_south', name: '南门（正门）', latitude: 40.247457, longitude: 116.150646 },
        { id: 'gate_east', name: '东门', latitude: 40.252661, longitude: 116.154921 },
        { id: 'gate_west', name: '西门', latitude: 40.252819, longitude: 116.145160 }
      ]
    }
  ]
}

export interface ReviewRecord {
  id: string
  groupId: string
  fromOpenid: string
  toOpenid: string
  score: number
  tags: string[]
  comment: string
  createTime: number
}

export interface ReportRecord {
  id: string
  groupId: string
  reporterOpenid: string
  reportedOpenid: string
  reason: string
  images: string[]
  description: string
  status: 'pending' | 'handled'
  createTime: number
}

interface MatchPlan {
  /** 第 2 人加入时间 */
  secondAt: number
  /** 第 3 人加入时间（targetSize=3） */
  thirdAt: number
}

export interface MockDB {
  user: UserInfo | null
  requests: RideRequest[]
  groups: RideGroup[]
  messages: ChatMessage[]
  reviews: ReviewRecord[]
  reports: ReportRecord[]
  matchPlan: Record<string, MatchPlan>
  tripSeed: TripRecord[]
}

function buildSeedTrips(): TripRecord[] {
  const now = Date.now()
  const day = 86400000
  return [
    {
      id: 'seed_trip_1',
      groupId: 'seed_group_1',
      direction: 'metro2school',
      stationName: '昌平西山口站',
      exitName: 'A 口',
      targetSize: 2,
      status: 'completed',
      price: 18,
      createTime: now - 2 * day - 3600000 * 20,
      members: [
        { ...PEER_POOL[1], openid: SELF_OPENID, nickName: '我', realName: '高罗也' },
        PEER_POOL[0]
      ],
      reviewed: true
    },
    {
      id: 'seed_trip_2',
      groupId: 'seed_group_2',
      direction: 'school2metro',
      stationName: '北京化工大学（昌平校区）',
      exitName: '南门（正门）',
      targetSize: 3,
      status: 'completed',
      price: 12,
      createTime: now - 5 * day - 3600000 * 19,
      members: [
        { ...PEER_POOL[1], openid: SELF_OPENID, nickName: '我', realName: '高罗也' },
        PEER_POOL[2],
        PEER_POOL[3]
      ],
      reviewed: false
    },
    {
      id: 'seed_trip_3',
      requestId: 'seed_req_3',
      direction: 'metro2school',
      stationName: '昌平西山口站',
      exitName: 'A 口',
      targetSize: 2,
      status: 'canceled',
      price: 18,
      createTime: now - 8 * day - 3600000 * 21,
      members: [{ ...PEER_POOL[1], openid: SELF_OPENID, nickName: '我', realName: '高罗也' }]
    }
  ]
}

function createDefaultDB(): MockDB {
  return {
    user: null,
    requests: [],
    groups: [],
    messages: [],
    reviews: [],
    reports: [],
    matchPlan: {},
    tripSeed: buildSeedTrips()
  }
}

export function getDB(): MockDB {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB
      // 兼容字段缺失
      return { ...createDefaultDB(), ...parsed }
    }
  } catch (err) {
    console.error('[MockStore] load failed:', err)
  }
  return createDefaultDB()
}

export function saveDB(db: MockDB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch (err) {
    console.error('[MockStore] save failed:', err)
  }
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** 根据当前登录用户构造自己的成员档案 */
export function buildSelfMember(user: UserInfo | null): RideMember {
  return {
    openid: SELF_OPENID,
    nickName: '我',
    avatar: user?.avatar || 'https://picsum.photos/id/64/200/200',
    realName: user?.realName || '同路人同学',
    creditScore: user?.creditScore ?? 100
  }
}
