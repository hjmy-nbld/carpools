// ============================================
// 全局类型定义 —— 校园拼车即时匹配
// ============================================

/** 出行方向：地铁站 → 学校 / 学校 → 地铁站 */
export type Direction = 'metro2school' | 'school2metro'

/** 账号状态 */
export type UserStatus = 'normal' | 'warned' | 'restricted' | 'banned'

export interface UserInfo {
  openid: string
  nickName: string
  avatar: string
  /** 真实姓名（注册时自行填写，供同学在企业微信中核验） */
  realName: string
  school: string
  /** 信用分 */
  creditScore: number
  status: UserStatus
  /** 默认拼车信息 */
  defaultWaitLocation?: string
  defaultOutfit?: string
  defaultPhoto?: string
  /** 完成拼车次数 */
  finishedCount?: number
  createTime?: number
}

/** 集合点出口 / 校门 */
export interface StationExit {
  id: string
  name: string
  latitude: number
  longitude: number
  /** 距离学校约多少公里，仅展示用 */
  distanceToSchool?: number
}

/** 集合点（地铁站 / 学校） */
export interface Station {
  id: string
  name: string
  type: 'metro' | 'school'
  exits: StationExit[]
}

export type RequestStatus = 'waiting' | 'matched' | 'canceled' | 'timeout' | 'completed'
export type GroupStatus = 'active' | 'completed' | 'canceled'

export interface RideMember {
  openid: string
  nickName: string
  avatar: string
  realName: string
  creditScore: number
}

/** 拼车请求（匹配池条目） */
export interface RideRequest {
  id: string
  openid: string
  direction: Direction
  stationId: string
  stationName: string
  exitId: string
  exitName: string
  targetSize: 2 | 3
  /** 打车参考报价（元） */
  price: number
  waitLocation: string
  outfit: string
  photo: string
  status: RequestStatus
  createTime: number
  groupId?: string
}

/** 拼车组 */
export interface RideGroup {
  id: string
  direction: Direction
  stationName: string
  exitName: string
  targetSize: number
  status: GroupStatus
  members: RideMember[]
  price: number
  createTime: number
  completedAt?: number
  canceledAt?: number
}

export type MessageType = 'text' | 'image' | 'quick' | 'system'

export interface ChatMessage {
  id: string
  groupId: string
  fromOpenid: string
  fromName: string
  avatar: string
  type: MessageType
  content: string
  createTime: number
}

export interface ChatSession {
  groupId: string
  direction: Direction
  stationName: string
  exitName: string
  targetSize: number
  memberCount: number
  members: RideMember[]
  status: GroupStatus
  lastMessage: string
  lastTime: number
  unread: number
}

/** 行程列表记录 */
export interface TripRecord {
  id: string
  groupId?: string
  requestId?: string
  direction: Direction
  stationName: string
  exitName: string
  targetSize: number
  /** waiting 匹配中 / active 已成型 / completed / canceled */
  status: 'waiting' | 'active' | 'completed' | 'canceled'
  price: number
  createTime: number
  members: RideMember[]
  reviewed?: boolean
}

export interface Announcement {
  id: string
  title: string
  content: string
}

/** 匹配状态轮询结果 */
export interface MatchingStatus {
  status: 'waiting' | 'matched' | 'timeout' | 'canceled'
  /** 已等待秒数 */
  elapsed: number
  /** 预计等待秒数（参考） */
  estimated: number
  /** 已加入人数（含自己） */
  joinedCount: number
  targetSize: number
  group?: RideGroup
}

export interface GpsVerifyResult {
  passed: boolean
  distance: number
  latitude: number
  longitude: number
  /** H5 预览为模拟定位 */
  mocked?: boolean
}
