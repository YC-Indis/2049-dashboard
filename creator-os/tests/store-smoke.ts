import assert from 'node:assert/strict'

const memory = new Map<string, string>()

Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem(key: string) {
        return memory.get(key) ?? null
      },
      setItem(key: string, value: string) {
        memory.set(key, value)
      },
    },
  },
})

const { creatorStore } = await import('../src/stores/creatorStore')

creatorStore.resetDemo()

assert.equal(creatorStore.state.contents.length, 12)
assert.equal(creatorStore.state.stageTasks.length, 18)

const created = creatorStore.createContent({
  title: '测试：把客户问题变成选题',
  role: 'acquisition',
  tier: 'B',
  type: '方法拆解',
  priority: 'normal',
  rawIdea: '来自一次真实咨询。',
})

assert.equal(creatorStore.state.contents.length, 13)
assert.equal(created.currentStage, 'idea')
assert.equal(creatorStore.getCurrentTask(created.id)?.status, 'unscheduled')

creatorStore.moveContentStage(created.id, 'recording')
assert.equal(created.currentStage, 'recording')
assert.equal(
  creatorStore.state.stageTasks.find(
    (task) => task.contentId === created.id && task.stage === 'idea',
  )?.status,
  'done',
)

const recordingTask = creatorStore.getCurrentTask(created.id)
assert.ok(recordingTask)
assert.equal(recordingTask.status, 'unscheduled')

creatorStore.scheduleTask(recordingTask.id, '2026-08-18')
assert.equal(recordingTask.status, 'scheduled')
assert.equal(recordingTask.plannedDate, '2026-08-18')

creatorStore.rescheduleTask(recordingTask.id, '2026-08-20')
assert.equal(recordingTask.plannedDate, '2026-08-20')

creatorStore.unscheduleTask(recordingTask.id)
assert.equal(recordingTask.status, 'unscheduled')
assert.equal(recordingTask.plannedDate, null)

const fixedEvent = creatorStore.scheduleFixedEvent('batch-review', '2026-08-16')
assert.equal(fixedEvent.date, '2026-08-16')
creatorStore.rescheduleCalendarEvent(fixedEvent.id, '2026-08-17')
assert.equal(fixedEvent.date, '2026-08-17')

creatorStore.completeTask(recordingTask.id)
assert.equal(created.currentStage, 'editing')
assert.equal(creatorStore.getCurrentTask(created.id)?.stage, 'editing')
assert.equal(creatorStore.getCurrentTask(created.id)?.status, 'unscheduled')

const pendingReview = creatorStore.state.reviews.find((review) => !review.reviewedAt)
assert.ok(pendingReview)
const ruleCount = creatorStore.state.rules.length
creatorStore.completeReview(pendingReview.id, '测试规则：先给结果，再解释判断。')
assert.ok(pendingReview.reviewedAt)
assert.equal(creatorStore.state.rules.length, ruleCount + 1)
assert.ok(memory.has('xia-creator-os-v1'))

console.log('Creator Store smoke tests passed')
