/** 将 LLM 输出整理为便于阅读的纯文本 */
export function formatAiText(raw: string): string {
  let text = (raw || '').trim()
  if (!text) return ''

  text = text.replace(/```(?:json|markdown|md|text)?\s*\n?([\s\S]*?)```/gi, (_, inner) => {
    const body = (inner as string).trim()
    if (body.startsWith('{') || body.startsWith('[')) {
      try {
        const parsed = JSON.parse(body)
        if (typeof parsed === 'object' && parsed !== null) {
          return flattenJsonToText(parsed)
        }
      } catch {
        /* keep */
      }
    }
    return body
  })

  if (/^\s*[\[{]/.test(text)) {
    try {
      text = flattenJsonToText(JSON.parse(text))
    } catch {
      /* not json */
    }
  }

  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1')
  text = text.replace(/\*([^*]+)\*/g, '$1')
  text = text.replace(/^[\s]*[-*+]\s+/gm, '· ')

  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function flattenJsonToText(data: unknown, depth = 0): string {
  if (data == null) return ''
  if (typeof data === 'string') return data
  if (typeof data === 'number' || typeof data === 'boolean') return String(data)
  if (Array.isArray(data)) {
    return data.map((item) => flattenJsonToText(item, depth + 1)).filter(Boolean).join('\n')
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const lines: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      const val = flattenJsonToText(v, depth + 1)
      if (val) lines.push(depth === 0 ? `${k}：${val}` : val)
    }
    return lines.join('\n\n')
  }
  return String(data)
}
