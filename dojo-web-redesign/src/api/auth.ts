import request from '@/utils/http'

/**
 * 登录
 * @param params 登录参数
 * @returns 登录响应
 */
export function fetchLogin(params: Api.Auth.LoginParams) {
  if (import.meta.env.VITE_ACCESS_MODE === 'frontend') {
    const normalizedName = params.userName.trim().toLowerCase()
    const isKnownAccount = normalizedName === 'super' || normalizedName === 'admin'
    if (!isKnownAccount || params.password !== '123456') {
      return Promise.reject(new Error('账号或密码错误'))
    }
    const role = normalizedName === 'super' ? 'R_SUPER' : 'R_ADMIN'
    window.localStorage.setItem('dojo-local-role', role)
    return Promise.resolve<Api.Auth.LoginResponse>({
      token: `dojo-local-${normalizedName}`,
      refreshToken: `dojo-local-refresh-${normalizedName}`
    })
  }
  return request.post<Api.Auth.LoginResponse>({
    url: '/api/auth/login',
    params
    // showSuccessMessage: true // 显示成功消息
    // showErrorMessage: false // 不显示错误消息
  })
}

/**
 * 获取用户信息
 * @returns 用户信息
 */
export async function fetchGetUserInfo() {
  if (import.meta.env.VITE_ACCESS_MODE === 'frontend') {
    const role = window.localStorage.getItem('dojo-local-role') || 'R_SUPER'
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
  // 去掉 Art Design Pro 演示邮箱里的 art 痕迹
  if (data?.email && /art\.design|artd\.pro|art-design/i.test(data.email)) {
    data.email = 'dojo@2049.team'
  }
  if (data?.userName && /^art$/i.test(data.userName)) {
    data.userName = 'Dojo'
  }
  return data
}
