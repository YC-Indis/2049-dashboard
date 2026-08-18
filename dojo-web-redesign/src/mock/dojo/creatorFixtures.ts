import type { CreatorContent, CreatorReview, CreatorRule } from '@/types/dojoCreator'

export function buildCreatorFixture(projectId: string): {
  contents: CreatorContent[]
  reviews: CreatorReview[]
  rules: CreatorRule[]
} {
  const contents: CreatorContent[] = [
    {
      id: 'creator-demo-01',
      projectId,
      title: '为什么多数内容计划，一周后就失效了？',
      summary: '从真实排期与执行阻力出发，拆解内容计划失效的三个原因。',
      role: 'acquisition',
      type: '观点表达',
      tier: 'A',
      priority: 'high',
      currentStage: 'script',
      plannedDate: null,
      createdAt: '2026-08-11T09:00:00.000Z',
      updatedAt: '2026-08-13T10:30:00.000Z'
    },
    {
      id: 'creator-demo-02',
      projectId,
      title: '把一次项目复盘，变成五条可发布内容',
      summary: '展示如何从交付记录中提炼冲突、证据和可迁移的方法。',
      role: 'trust',
      type: '方法拆解',
      tier: 'A',
      priority: 'normal',
      currentStage: 'outline',
      plannedDate: null,
      createdAt: '2026-08-10T09:00:00.000Z',
      updatedAt: '2026-08-12T14:20:00.000Z'
    },
    {
      id: 'creator-demo-03',
      projectId,
      title: '一次低播放内容，真正应该复盘什么？',
      summary: '用结果、判断与下一次行动取代空泛的数据总结。',
      role: 'conversion',
      type: '案例复盘',
      tier: 'B',
      priority: 'normal',
      currentStage: 'publish',
      plannedDate: null,
      createdAt: '2026-08-05T09:00:00.000Z',
      updatedAt: '2026-08-12T18:00:00.000Z'
    }
  ]

  return {
    contents,
    reviews: [
      {
        id: 'creator-review-01',
        contentId: 'creator-demo-03',
        dueDate: '2026-08-16',
        rating: 0,
        result: '',
        reason: ''
      }
    ],
    rules: [
      {
        id: 'creator-rule-01',
        text: '先给出真实结果，再解释判断过程；不要让结论藏在铺垫后面。',
        dimension: 'copy',
        sourceContentId: 'creator-demo-03',
        createdAt: '2026-08-08',
        usageCount: 2
      }
    ]
  }
}
