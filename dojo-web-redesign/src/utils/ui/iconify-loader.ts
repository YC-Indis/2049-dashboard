/**
 * 离线图标：不依赖 api.iconify.design，避免侧栏/助手按钮变成空框。
 */
import { addCollection } from '@iconify/vue'
import ph from '@/assets/iconify/ph.json'
import ri from '@/assets/iconify/ri.json'

addCollection(ph as never)
addCollection(ri as never)
