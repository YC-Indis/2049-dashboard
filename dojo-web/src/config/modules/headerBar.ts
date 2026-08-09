/**
 * 顶部栏功能配置
 *
 * 统一管理顶部栏各个功能模块的启用状态。
 * 通过修改此配置文件可以快速启用或禁用顶部栏的功能按钮。
 *
 * @module config/headerBar
 * @author Art Design Pro Team
 */

import { HeaderBarFeatureConfig } from '@/types'

/**
 * 顶部栏功能配置对象
 */
export const headerBarConfig: HeaderBarFeatureConfig = {
  menuButton: {
    enabled: true,
    description: '控制左侧菜单的展开/收起按钮'
  },
  refreshButton: {
    enabled: true,
    description: '页面刷新按钮'
  },
  fastEnter: {
    enabled: false,
    description: '已移除：Art Design Pro 演示入口，Dojo 不需要'
  },
  breadcrumb: {
    enabled: true,
    description: '面包屑导航，显示当前页面路径'
  },
  globalSearch: {
    enabled: false,
    description: '已禁用：Dojo 用左侧导航直达，不需要全局搜索'
  },
  fullscreen: {
    enabled: false,
    description: '已移除：浏览器 F11 即可'
  },
  notification: {
    enabled: true,
    description: '通知中心，显示系统通知和消息'
  },
  chat: {
    enabled: false,
    description: '已禁用 Art Bot，使用 Dojo 浮窗 Agent'
  },
  language: {
    enabled: false,
    description: '已移除：Dojo 只用中文'
  },
  settings: {
    enabled: false,
    description: '已禁用：Dojo 只保留日间/夜间切换'
  },
  themeToggle: {
    enabled: true,
    description: '主题切换功能（明暗主题）'
  }
}

export default headerBarConfig
