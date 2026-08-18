<script setup lang="ts">
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'

  export interface VideoPreviewMetric {
    label: string
    value: string
  }

  const props = withDefaults(
    defineProps<{
      title: string
      url?: string
      poster?: string
      author?: string
      eyebrow?: string
      metrics?: VideoPreviewMetric[]
      emptyText?: string
      playerOnly?: boolean
      tall?: boolean
    }>(),
    {
      url: '',
      poster: '',
      author: '',
      eyebrow: 'VIDEO PREVIEW',
      metrics: () => [],
      emptyText: '当前视频没有可用的预览地址',
      playerOnly: false,
      tall: false
    }
  )

  const directVideoUrl = computed(() =>
    /\.(mp4|webm|ogg)(\?.*)?$/i.test(props.url) ? props.url : ''
  )
  const embedUrl = computed(() => {
    if (!props.url || directVideoUrl.value) return ''
    const tikTokId = props.url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i)?.[1]
    if (tikTokId) return 'https://www.tiktok.com/player/v1/' + tikTokId + '?autoplay=0&loop=0'
    const youtubeId = props.url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/i
    )?.[1]
    if (youtubeId) return 'https://www.youtube-nocookie.com/embed/' + youtubeId
    return ''
  })

  const canPreview = computed(() => Boolean(directVideoUrl.value || embedUrl.value))
</script>

<template>
  <section
    class="video-preview-panel"
    :class="{ 'has-preview': canPreview, 'is-player-only': playerOnly, 'is-tall': tall }"
  >
    <div class="video-preview-panel__player">
      <div class="video-preview-panel__stage">
        <video
          v-if="directVideoUrl"
          :src="directVideoUrl"
          :poster="poster"
          controls
          playsinline
          preload="metadata"
        />
        <iframe
          v-else-if="embedUrl"
          :src="embedUrl"
          :title="title"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        />
        <div v-else class="video-preview-panel__empty">
          <img v-if="poster" :src="poster" alt="" />
          <Icon icon="ph:play-circle-duotone" width="38" />
          <span>{{ emptyText }}</span>
        </div>
      </div>
    </div>

    <div v-if="!playerOnly" class="video-preview-panel__body">
      <header>
        <span>{{ eyebrow }}</span>
        <h3>{{ title }}</h3>
        <p v-if="author">{{ author }}</p>
      </header>

      <dl v-if="metrics.length">
        <div v-for="metric in metrics" :key="metric.label">
          <dt>{{ metric.label }}</dt>
          <dd>{{ metric.value }}</dd>
        </div>
      </dl>

      <footer>
        <span><i /> 站内预览</span>
        <a v-if="url" :href="url" target="_blank" rel="noopener">
          原始链接
          <Icon icon="ph:arrow-up-right" width="13" />
        </a>
        <slot name="actions" />
      </footer>
    </div>
  </section>
</template>

<style scoped lang="scss">
  .video-preview-panel {
    display: grid;
    grid-template-columns: minmax(220px, 300px) minmax(0, 1fr);
    min-height: 360px;
    overflow: hidden;
    color: var(--dojo-ink);
    background: var(--dojo-paper);
    border: 1px solid var(--dojo-line);
    border-radius: 12px;
  }

  .video-preview-panel.is-player-only {
    display: grid;
    height: 100%;
    min-height: 0;
    background: transparent;
    border-color: transparent;
    box-shadow: none;

    .video-preview-panel__player {
      container-type: size;
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      background: transparent;
    }

    .video-preview-panel__stage {
      width: min(100cqw, calc(100cqh * 9 / 16));
      height: min(100cqh, calc(100cqw * 16 / 9));
      aspect-ratio: 9 / 16;
    }

    .video-preview-panel__player video,
    .video-preview-panel__player iframe,
    .video-preview-panel__empty {
      width: 100%;
      height: 100%;
      min-height: 0;
      object-fit: contain;
      border: 0;
      background: transparent;
    }
  }

  .video-preview-panel.is-tall:not(.is-player-only) {
    grid-template-columns: minmax(310px, 360px) minmax(0, 1fr);
    min-height: 640px;

    .video-preview-panel__player,
    .video-preview-panel__player video,
    .video-preview-panel__player iframe {
      min-height: 640px;
    }
  }

  .video-preview-panel__player {
    display: grid;
    place-items: center;
    min-height: 360px;
    overflow: hidden;
    background: #161b22;

    .video-preview-panel__stage {
      width: 100%;
      height: 100%;
      min-height: 360px;
    }

    video,
    iframe {
      width: 100%;
      height: 100%;
      min-height: 360px;
      object-fit: contain;
      border: 0;
    }
  }

  .video-preview-panel__empty {
    position: relative;
    display: grid;
    gap: 10px;
    place-items: center;
    width: 100%;
    height: 100%;
    padding: 24px;
    color: #a9b4c2;
    text-align: center;

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.34;
    }

    svg,
    span {
      z-index: 1;
    }

    span {
      max-width: 22ch;
      font-size: 10px;
      line-height: 1.5;
    }
  }

  .video-preview-panel__body {
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 20px;
    min-width: 0;
    padding: 22px;

    header > span {
      font-size: 8px;
      font-weight: 700;
      color: var(--dojo-accent);
      letter-spacing: 0.12em;
    }

    h3 {
      margin: 8px 0 0;
      font-size: 18px;
      line-height: 1.35;
    }

    header p {
      margin: 6px 0 0;
      font-size: 10px;
      color: var(--dojo-muted);
    }

    dl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-content: start;
      margin: 0;
    }

    dl > div {
      padding: 10px;
      background: var(--dojo-paper-muted);
      border-radius: 8px;
    }

    dt {
      font-size: 8px;
      color: var(--dojo-muted);
    }

    dd {
      margin: 4px 0 0;
      font-size: 13px;
      font-weight: 650;
      font-variant-numeric: tabular-nums;
    }

    footer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding-top: 14px;
      border-top: 1px solid var(--dojo-line-soft);
    }

    footer > span {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      margin-right: auto;
      font-size: 9px;
      color: var(--dojo-muted);

      i {
        width: 6px;
        height: 6px;
        background: var(--dojo-green);
        border-radius: 50%;
      }
    }

    a {
      display: inline-flex;
      gap: 4px;
      align-items: center;
      font-size: 9px;
      color: var(--dojo-accent-strong);
      text-decoration: none;
    }
  }

  @media (width <= 620px) {
    .video-preview-panel {
      grid-template-columns: 1fr;
    }

    .video-preview-panel__player,
    .video-preview-panel__player video,
    .video-preview-panel__player iframe {
      min-height: 460px;
    }

    .video-preview-panel.is-player-only .video-preview-panel__player,
    .video-preview-panel.is-player-only .video-preview-panel__stage,
    .video-preview-panel.is-player-only .video-preview-panel__player video,
    .video-preview-panel.is-player-only .video-preview-panel__player iframe {
      min-height: 420px;
      height: min(70vh, 640px);
    }

    .video-preview-panel.is-tall:not(.is-player-only) {
      grid-template-columns: 1fr;
      min-height: 0;
    }

    .video-preview-panel.is-tall:not(.is-player-only) .video-preview-panel__player,
    .video-preview-panel.is-tall:not(.is-player-only) .video-preview-panel__player video,
    .video-preview-panel.is-tall:not(.is-player-only) .video-preview-panel__player iframe {
      min-height: 560px;
    }
  }
</style>
