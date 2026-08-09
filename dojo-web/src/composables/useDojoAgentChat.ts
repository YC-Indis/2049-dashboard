import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { chatAgent } from '@/api/llm'
import {
  appendGlobalChatMessage,
  dojoChatStore,
  getGlobalChatMessages
} from '@/store/dojoChatStore'
import {
  contentFlowItems,
  demoAccounts,
  demoProject,
  demoTasks,
  publishRecords,
  weeklyReportTemplate
} from '@/mock/dojo/fixture'
import { overviewStats } from '@/store/dojoOverview'
import { formatAiText } from '@/utils/formatAiText'
import { formatMenuTitle } from '@/utils/router'

export function useDojoAgentChat() {
  const route = useRoute()
  const messages = computed(() => getGlobalChatMessages())
  const pageLabel = computed(() => formatMenuTitle(route.meta?.title as string))

  async function send(message: string) {
    const history = messages.value
      .filter((m) => m.content)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }))

    appendGlobalChatMessage({ role: 'user', content: message })
    dojoChatStore.loading = true

    try {
      const reply = await chatAgent(
        message,
        {
          page: pageLabel.value,
          project: demoProject,
          stats: overviewStats.value,
          tasks: demoTasks,
          accounts: demoAccounts,
          flow: contentFlowItems,
          publishes: publishRecords.slice(0, 20),
          weeklyStyle: weeklyReportTemplate
        },
        history
      )
      appendGlobalChatMessage({
        role: 'assistant',
        content: reply.content,
        sources: reply.sources,
        memoryHint: reply.memoryHint
      })
    } catch (e) {
      appendGlobalChatMessage({
        role: 'assistant',
        content: formatAiText(e instanceof Error ? e.message : '请求失败')
      })
    } finally {
      dojoChatStore.loading = false
    }
  }

  return { messages, pageLabel, send, loading: computed(() => dojoChatStore.loading) }
}
