/** Dojo 业务通知 — 替代 Art Design Pro 模板通知 */

export type DojoNoticeType = 'confirm' | 'overdue' | 'account' | 'publish' | 'agent'

export interface DojoNotice {
  title: string
  time: string
  type: DojoNoticeType
  route?: string
}

export interface DojoTodo {
  title: string
  time: string
  priority: 'high' | 'medium'
  route: string
}

export const dojoNotices: DojoNotice[] = [
  {
    title: '2 条任务需对照时间规划推进（T-104 / T-105）',
    time: '今天 09:00',
    type: 'confirm',
    route: '/timeline'
  },
  {
    title: '账号 @vape.uk.daily 检阅异常，发布任务已阻塞',
    time: '今天 08:40',
    type: 'account',
    route: '/accounts/review'
  },
  {
    title: '2 条任务逾期：脚本修补 / 素材包交付',
    time: '昨天 18:00',
    type: 'overdue',
    route: '/today'
  },
  {
    title: '第三周脚本还差 2 条待客户确认',
    time: '03-06',
    type: 'confirm',
    route: '/scripts'
  },
  {
    title: '投放账号粉丝量可穿透同步至总账号预览',
    time: '03-05',
    type: 'agent',
    route: '/accounts/review'
  }
]

export const dojoTodos: DojoTodo[] = [
  {
    title: '对照时间规划确认第 4 周发布计划（12 条）',
    time: '今天截止',
    priority: 'high',
    route: '/timeline'
  },
  {
    title: '审核 3 条待过审脚本',
    time: '今天截止',
    priority: 'high',
    route: '/scripts'
  },
  {
    title: '录入昨日 4 条分发数据（dojo数据字段）',
    time: '今天',
    priority: 'medium',
    route: '/distribution'
  },
  {
    title: 'RapidAPI 同步未投放账号粉丝量',
    time: '待处理',
    priority: 'medium',
    route: '/accounts/review'
  }
]
