/** 脚本正文以人物为主，不用 Markdown 标题/加粗/列表。 */

export function stripMarkdown(text: string) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*/g, '').trim())
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(^|[^*\n])\*(?!\s)(.+?)\*/g, '$1$2')
    .replace(/^>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function speakerName(sourceAuthor?: string) {
  const raw = String(sourceAuthor || '').replace(/^@/, '').trim()
  return raw || '出镜人'
}

export function buildCharacterScriptDraft(input: {
  sourceAuthor?: string
  referenceUrl?: string
  transcript?: string
  visualNotes?: string
  hook?: string
}) {
  const speaker = speakerName(input.sourceAuthor)
  const transcript = input.transcript?.trim()
  const visual = input.visualNotes?.trim()
  const hook = input.hook?.trim()
  const lines = [
    `${speaker}`,
    input.sourceAuthor ? `账号 ${input.sourceAuthor}` : '',
    input.referenceUrl ? `参考片 ${input.referenceUrl}` : '',
    '',
    hook ? `${speaker}（开场）\n${hook}` : '',
    transcript ? `${speaker}（口播）\n${transcript}` : '',
    visual ? `画面\n${visual}` : '画面\n对照左侧参考片补镜头。AI 看不到原片。'
  ]
  return lines.filter((line, index, list) => line !== '' || list[index - 1] !== '').join('\n').trim()
}
