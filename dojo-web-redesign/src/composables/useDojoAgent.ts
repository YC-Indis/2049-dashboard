import { ref } from 'vue'

const seed = ref({ text: '', n: 0 })

/** 从任意页面唤起全局浮动 Agent */
export function useDojoAgent() {
  function openAgent(prompt?: string) {
    seed.value = { text: prompt || '今天具体做什么？', n: seed.value.n + 1 }
    window.dispatchEvent(new CustomEvent('dojo-agent-open'))
  }

  return { seed, openAgent }
}
