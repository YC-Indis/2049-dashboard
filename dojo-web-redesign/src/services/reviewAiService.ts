interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: string | { message?: string }
}

export interface ReviewSynthesisInput {
  sourceTitle: string
  manualNotes: string
  shotNotes: string
  copyNotes: string
  musicNotes: string
  result: string
  reason: string
}

export async function requestReviewSynthesis(input: ReviewSynthesisInput) {
  const response = await fetch('/api/local/deepseek/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            '你是个人内容知识库整理助手。只基于用户记录的事实整理，不补写未提供的画面、音乐或数据。输出四段简洁中文：核心启发、镜头可复用点、话术可复用点、音乐可复用点；缺失维度明确写“尚未记录”。'
        },
        {
          role: 'user',
          content: [
            `来源：${input.sourceTitle}`,
            `我的启发：${input.manualNotes || '未填写'}`,
            `镜头记录：${input.shotNotes || '未填写'}`,
            `话术记录：${input.copyNotes || '未填写'}`,
            `音乐记录：${input.musicNotes || '未填写'}`,
            `真实结果：${input.result || '未填写'}`,
            `原因判断：${input.reason || '未填写'}`
          ].join('\n')
        }
      ]
    })
  })
  const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse
  if (!response.ok) throw new Error(errorMessage(payload, response.status))
  const answer = payload.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('DeepSeek 没有返回有效整理结果')
  return answer
}

function errorMessage(payload: DeepSeekResponse, status: number) {
  if (typeof payload.error === 'string') return payload.error
  if (payload.error?.message) return payload.error.message
  return `DeepSeek 请求失败（${status}）`
}
