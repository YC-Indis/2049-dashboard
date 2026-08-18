<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
  import type { EChartsOption } from '@/plugins/echarts'
  import { useChart } from '@/hooks/core/useChart'

  interface LineSeries {
    name: string
    values: number[]
    color: string
  }

  interface ScatterPoint {
    id: string
    name: string
    value: [number, number, number]
    color: string
  }

  const props = defineProps<{
    kind: 'line' | 'scatter'
    labels?: string[]
    lineSeries?: LineSeries[]
    points?: ScatterPoint[]
    height?: string
  }>()

  const emit = defineEmits<{
    select: [id: string]
  }>()

  const { chartRef, initChart, getChartInstance } = useChart({ autoTheme: false })

  const options = computed<EChartsOption>(() => {
    const axisLabel = {
      color: '#938982',
      fontSize: 10
    }
    const splitLine = {
      lineStyle: {
        color: '#ebe4dc',
        type: 'dashed' as const
      }
    }
    const tooltip = {
      backgroundColor: '#fffdf9',
      borderColor: '#ded6cd',
      borderWidth: 1,
      padding: 10,
      textStyle: {
        color: '#292522',
        fontSize: 11
      }
    }

    if (props.kind === 'scatter') {
      return {
        animationDuration: 700,
        animationEasing: 'quarticOut',
        grid: {
          top: 17,
          right: 24,
          bottom: 32,
          left: 38
        },
        tooltip: {
          ...tooltip,
          trigger: 'item',
          formatter: (params: any) => {
            const point = params.data as ScatterPoint
            return `${point.name}<br/>增长 ${point.value[0]}% · 互动 ${point.value[1]}%`
          }
        },
        xAxis: {
          type: 'value',
          name: '增长斜率',
          nameTextStyle: axisLabel,
          axisLabel: {
            ...axisLabel,
            formatter: '{value}%'
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine
        },
        yAxis: {
          type: 'value',
          name: '互动率',
          nameTextStyle: axisLabel,
          axisLabel: {
            ...axisLabel,
            formatter: '{value}%'
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine
        },
        series: [
          {
            type: 'scatter',
            data: props.points || [],
            symbolSize: (value: number[]) => Math.max(12, Math.min(34, 10 + value[2] / 35)),
            itemStyle: {
              color: (params: { data: ScatterPoint }) => params.data.color,
              opacity: 0.82,
              shadowBlur: 10,
              shadowColor: 'rgba(56, 42, 34, 0.12)',
              shadowOffsetY: 4
            },
            emphasis: {
              scale: 1.25,
              itemStyle: { opacity: 1 }
            }
          }
        ]
      } as EChartsOption
    }

    return {
      animationDuration: 750,
      animationEasing: 'quarticOut',
      color: props.lineSeries?.map((series) => series.color),
      grid: {
        top: 20,
        right: 16,
        bottom: 28,
        left: 43
      },
      tooltip: {
        ...tooltip,
        trigger: 'axis'
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 8,
        itemHeight: 8,
        textStyle: axisLabel
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: props.labels || [],
        axisLabel,
        axisLine: { lineStyle: { color: '#ded6cd' } },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        axisLabel,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine
      },
      series: (props.lineSeries || []).map((series, index) => ({
        name: series.name,
        type: 'line',
        data: series.values,
        smooth: 0.32,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        lineStyle: {
          width: index === 0 ? 3 : 2
        },
        areaStyle:
          index === 0
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: 'rgba(216, 91, 77, 0.18)' },
                    { offset: 1, color: 'rgba(216, 91, 77, 0)' }
                  ]
                }
              }
            : undefined,
        emphasis: { focus: 'series' }
      }))
    } as EChartsOption
  })

  function renderChart() {
    initChart(options.value)
    const chart = getChartInstance()
    if (!chart) return
    chart.off('click')
    chart.on('click', (params: any) => {
      const point = params.data as ScatterPoint | undefined
      if (point?.id) emit('select', point.id)
    })
  }

  watch(options, () => nextTick(renderChart), { deep: true })

  onMounted(() => nextTick(renderChart))

  onBeforeUnmount(() => {
    getChartInstance()?.off('click')
  })
</script>

<template>
  <div ref="chartRef" class="operations-chart" :style="{ height: height || '270px' }" />
</template>

<style scoped>
  .operations-chart {
    width: 100%;
    min-width: 0;
  }
</style>
