/**
 * 统一服务调用层
 *
 * 两条数据通道（由 src/config 的 API_BASE_URL 决定）：
 * 1. Python 后端模式（API_BASE_URL 非空）：HTTP POST {base}/api/{name}，Bearer Token 鉴权
 * 2. H5 预览模式（API_BASE_URL 为空）：动态加载 src/data 下的同名 Mock 模块
 */
import Taro from '@tarojs/taro'
import { API_BASE_URL, API_ENABLED } from '@/config'

// Token 在本地缓存中的键名
const TOKEN_KEY = 'carpool_token'

/** 读取登录令牌 */
export function getToken(): string {
  try {
    return Taro.getStorageSync(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

/** 保存登录令牌 */
export function setToken(token: string) {
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
  } catch (err) {
    console.error('[Cloud] save token failed:', err)
  }
}

/** 清除登录令牌（退出登录时调用） */
export function clearToken() {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

/** Python 后端模式下是否已登录（H5 Mock 模式恒为 true） */
export function isLoggedIn(): boolean {
  return !API_ENABLED || !!getToken()
}

/** 后端统一响应信封 */
interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

/**
 * 统一接口调用：业务代码只认 callFunction(name, data)，不感知底层通道。
 * @param name 接口名（对应后端 /api/{name}，与 src/data/{name}.ts Mock 同名）
 * @param data 请求参数
 */
export async function callFunction<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  // —— Python 后端模式 ——
  if (API_ENABLED) {
    const header: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`

    let res: Taro.request.SuccessCallbackResult<any>
    try {
      res = await Taro.request({
        url: `${API_BASE_URL}/api/${name}`,
        method: 'POST',
        data: data || {},
        header,
        timeout: 15000
      })
    } catch (err) {
      // 网络层错误：按超时 / 连接失败分类，带上当前后端地址便于诊断
      const msg = String((err as { errMsg?: string })?.errMsg || err || '')
      if (msg.includes('timeout')) {
        throw new Error(`请求超时（${API_BASE_URL}），请确认后端已启动`)
      }
      throw new Error(`网络连接失败（${API_BASE_URL}），请确认后端已启动且手机与电脑在同一网络`)
    }

    // 登录/注册成功后后端通过响应头下发/续期令牌
    const respHeader = (res.header || {}) as Record<string, string>
    const newToken = respHeader['X-Auth-Token'] || respHeader['x-auth-token']
    if (newToken) setToken(newToken)

    if (res.statusCode === 401) {
      // 未登录属正常状态（如首屏尚未选择测试账号），不打 error 以免触发预览告警
      const result401 = res.data as ApiEnvelope<T>
      throw new Error(result401?.message || '未登录或登录已失效，请重新选择测试账号登录')
    }
    if (res.statusCode !== 200) {
      console.error(`[Cloud] ${name} HTTP ${res.statusCode}`)
      throw new Error(`服务异常（HTTP ${res.statusCode}），请稍后重试`)
    }

    const result = res.data as ApiEnvelope<T>
    if (!result || result.code !== 0) {
      const message = result?.message || '请求失败，请确认 Python 后端已启动'
      console.error(`[Cloud] ${name} failed:`, message)
      throw new Error(message)
    }
    return result.data
  }

  // —— H5 预览模式：本地 Mock ——
  const mockModule = await import(`../data/${name}`)
  return mockModule.default(data) as T
}

/**
 * 统一图片上传：
 * - Python 后端模式：multipart 上传到 /api/upload（字段名 file），返回可访问 URL
 * - H5 Mock 模式：直接返回本地临时路径（不真正上传）
 */
export async function uploadImage(filePath: string): Promise<string> {
  if (API_ENABLED) {
    const header: Record<string, string> = {}
    const token = getToken()
    if (token) header.Authorization = `Bearer ${token}`

    const res = await Taro.uploadFile({
      url: `${API_BASE_URL}/api/upload`,
      filePath,
      name: 'file',
      header
    })
    let parsed: ApiEnvelope<{ url: string; fileID: string }>
    try {
      parsed = JSON.parse(res.data)
    } catch {
      throw new Error(`图片上传响应解析失败（${API_BASE_URL}），请确认后端已启动`)
    }
    if (parsed.code !== 0) throw new Error(parsed.message || '图片上传失败')
    return parsed.data.url
  }

  return filePath
}
