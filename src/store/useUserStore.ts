/**
 * 全局用户状态（zustand 风格 store）：维护登录态与用户资料，负责本地缓存与启动初始化
 *
 * init 先读 Taro Storage 缓存渲染，再静默调用 login 同步云端；
 * Python 后端模式下未选择测试账号（无 token）时跳过匿名登录。
 */
import Taro from '@tarojs/taro'
import { create } from 'zustand'
import type { UserInfo } from '@/types'
import { callFunction, getToken, clearToken } from '@/services/cloud'
import { API_ENABLED } from '@/config'

const STORAGE_KEY = 'carpool_user'

interface UserState {
  user: UserInfo | null
  ready: boolean
  /** 启动时：先读本地缓存，再静默同步云端用户 */
  init: () => Promise<void>
  /** 强制登录（拉取 / 创建用户） */
  login: () => Promise<UserInfo>
  setUser: (user: UserInfo) => void
  /** 重新拉取最新资料（姓名 / 信用分等） */
  refresh: () => Promise<UserInfo>
  /** 退出登录：清除本地令牌与缓存用户，恢复未登录状态 */
  logout: () => void
}

function cacheUser(user: UserInfo | null) {
  try {
    if (user) {
      Taro.setStorageSync(STORAGE_KEY, user)
    } else {
      Taro.removeStorageSync(STORAGE_KEY)
    }
  } catch (err) {
    console.error('[UserStore] cache failed:', err)
  }
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  ready: false,

  init: async () => {
    let cached: UserInfo | null = null
    try {
      cached = Taro.getStorageSync(STORAGE_KEY) || null
    } catch (err) {
      console.error('[UserStore] read cache failed:', err)
    }
    if (cached) set({ user: cached })
    // Python 后端模式下，未选择测试账号（无 token）时不做匿名登录
    if (API_ENABLED && !getToken()) {
      set({ ready: true })
      return
    }
    try {
      const user = await callFunction<UserInfo>('login')
      cacheUser(user)
      set({ user, ready: true })
    } catch (err) {
      console.error('[UserStore] silent login failed:', err)
      set({ ready: true })
    }
  },

  login: async () => {
    const user = await callFunction<UserInfo>('login')
    cacheUser(user)
    set({ user, ready: true })
    return user
  },

  setUser: (user) => {
    cacheUser(user)
    set({ user })
  },

  refresh: async () => {
    const user = await callFunction<UserInfo>('getProfile')
    cacheUser(user)
    set({ user })
    return user
  },

  logout: () => {
    clearToken()
    cacheUser(null)
    set({ user: null, ready: true })
  }
}))

export { STORAGE_KEY }
