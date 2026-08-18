import type { ExecutableInspiration, ScriptConversationMessage } from '@/types/dojoInspiration'

interface DeepSeekResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: string | { message?: string }
}

export interface InspirationRewriteInput {
  title: string
  sourceAuthor?: string
  referenceUrl?: string
  transcript?: string
  visualNotes?: string
  annotations?: string[]
}

export async function requestInspirationRewrite(
  inspiration: InspirationRewriteInput,
  conversation: ScriptConversationMessage[]
) {
  const response = await fetch('/api/local/deepseek/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            '你是分镜编剧，只根据用户写下的文字改稿，看不到原片，不要编造没写过的镜头。\n输出必须以人物为中心的可拍口播稿，不要 Markdown（不要 #、**、列表符号、代码块）。\n固定格式：\n出镜人（动作）\n口播\n\n画面\n镜头说明\n\n可以换人名。信息不够就用一句人话追问。最终稿必须等人确认。'
        },
        {
          role: 'user',
          content: inspirationContext(inspiration)
        },
        ...conversation.slice(-12).map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        }))
      ]
    })
  })
  const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse
  if (!response.ok) throw new Error(errorMessage(payload, response.status))
  const answer = payload.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('DeepSeek 没有返回有效内容，请稍后重试')
  return answer
}

export function toRewriteInput(
  inspiration: Pick<
    ExecutableInspiration,
    'title' | 'sourceAuthor' | 'referenceUrl' | 'transcript' | 'visualNotes' | 'annotations' | 'hook'
  >,
  draft?: { transcript?: string; visualNotes?: string }
): InspirationRewriteInput {
  return {
    title: inspiration.title,
    sourceAuthor: inspiration.sourceAuthor,
    referenceUrl: inspiration.referenceUrl,
    transcript: draft?.transcript ?? inspiration.transcript,
    visualNotes: draft?.visualNotes ?? inspiration.visualNotes,
    annotations: [
      inspiration.hook?.trim() ? `Hook：${inspiration.hook.trim()}` : '',
      ...(inspiration.annotations || []).map((item) => item.text)
    ].filter(Boolean)
  }
}

function inspirationContext(inspiration: InspirationRewriteInput) {
  return [
    `当前灵感：${inspiration.title}`,
    `来源账号：${inspiration.sourceAuthor || '未记录'}`,
    `原版参考链接：${inspiration.referenceUrl || '无'}`,
    `口播 / 正文：${inspiration.transcript?.trim() || '未填写'}`,
    `画面笔记：${inspiration.visualNotes?.trim() || '未填写'}`,
    inspiration.annotations?.length
      ? `改编需求：${inspiration.annotations.join('；')}`
      : '',
    '要求：只根据用户写下的画面和口播改稿。看不到原片，不要编造镜头。输出以人物为主的口播稿，不要 Markdown。改完后等人确认。'
  ]
    .filter(Boolean)
    .join('\n')
}

function errorMessage(payload: DeepSeekResponse, status: number) {
  if (typeof payload.error === 'string') return payload.error
  if (payload.error?.message) return payload.error.message
  return `DeepSeek 请求失败（${status}）`
}
