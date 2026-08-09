import request from '@/utils/http'

/**
 * 登录
 * @param params 登录参数
 * @returns 登录响应
 */
export function fetchLogin(params: Api.Auth.LoginParams) {
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
