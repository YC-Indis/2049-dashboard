import request from '@/utils/http'

const DOJO_API = import.meta.env.VITE_DOJO_API_BASE || '/api/dojo'
const ROLE_KEY = 'dojo-local-role'
const TOKEN_KEY = 'dojo-auth-token'

/**
 * 登录有三条路，按部署形态选：
 *
 *   服务端校验  后端配了 DOJO_AUTH_PASSWORD，口令在服务器上比对，公网部署走这条
 *   本地校验    后端没配或连不上，沿用浏览器内校验，本机开发和离线演示走这条
 *   独立后端    VITE_ACCESS_MODE 切到 backend，交给外部鉴权服务
 *
 * 前两条的差别对使用者不可见，登录页不用改。
 */

let serverAuthEnabled: boolean | null = null

async function detectServerAuth(): Promise<boolean> {
  if (serverAuthEnabled !== null) return serverAuthEnabled
  try {
    const res = await fetch(`${DOJO_API}/auth/mode`, {
      signal: AbortSignal.timeout(2000)
    })
    serverAuthEnabled = res.ok ? Boolean((await res.json())?.enabled) : false
  } catch {
    // 后端没起来也要能进去看已经缓存在本地的数据
    serverAuthEnabled = false
  }
  return serverAuthEnabled
}

export function getAuthToken(): string {
  return window.localStorage.getItem(TOKEN_KEY) || ''
}

export function clearAuthToken() {
  window.localStorage.removeItem(TOKEN_KEY)
}

async function loginOnServer(params: Api.Auth.LoginParams): Promise<Api.Auth.LoginResponse> {
  const res = await fetch(`${DOJO_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: params.userName, password: params.password })
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(body?.message || '账号或密码错误')
  }
  window.localStorage.setItem(TOKEN_KEY, body.token)
  window.localStorage.setItem(ROLE_KEY, body.role)
  return { token: body.token, refreshToken: body.refreshToken || '' }
}

function loginLocally(params: Api.Auth.LoginParams): Api.Auth.LoginResponse {
  const name = params.userName.trim().toLowerCase()
  const role = name === 'super' ? 'R_SUPER' : name === 'admin' ? 'R_ADMIN' : ''
  if (!role) {
    throw new Error('账号或密码错误')
  }
  window.localStorage.setItem(ROLE_KEY, role)
  clearAuthToken()
  return {
    token: `dojo-local-${name}`,
    refreshToken: `dojo-local-refresh-${name}`
  }
}

export async function fetchLogin(params: Api.Auth.LoginParams) {
  if (import.meta.env.VITE_ACCESS_MODE === 'frontend') {
    if (await detectServerAuth()) {
      return loginOnServer(params)
    }
    return loginLocally(params)
  }
  return request.post<Api.Auth.LoginResponse>({
    url: '/api/auth/login',
    params
  })
}

export async function fetchGetUserInfo() {
  if (import.meta.env.VITE_ACCESS_MODE === 'frontend') {
    const token = getAuthToken()
    if (token) {
      const res = await fetch(`${DOJO_API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) return (await res.json()) as Api.Auth.UserInfo
      // 令牌过期或签名盐换过了，清掉重新登录
      clearAuthToken()
      throw new Error('登录已过期，请重新登录')
    }

    const role = window.localStorage.getItem(ROLE_KEY) || 'R_SUPER'
    return {
      buttons: ['*'],
      roles: [role],
      userId: role === 'R_SUPER' ? 1 : 2,
      userName: role === 'R_SUPER' ? 'Super' : 'Admin',
      email: 'dojo@2049.local'
    } satisfies Api.Auth.UserInfo
  }

  const data = await request.get<Api.Auth.UserInfo>({
    url: '/api/user/info'
  })
  // 模板演示数据里的 art 邮箱会漏到用户菜单上
  if (data?.email && /art\.design|artd\.pro|art-design/i.test(data.email)) {
    data.email = 'dojo@2049.team'
  }
  if (data?.userName && /^art$/i.test(data.userName)) {
    data.userName = 'Dojo'
  }
  return data
}
