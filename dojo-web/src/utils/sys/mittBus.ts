/**
 * 全局事件总线。
 *
 * 只放那些「触发方和响应方隔了好几层」的信号：顶栏按钮要打开挂在 layout 根上
 * 的设置面板、搜索框、锁屏。这类如果用 props 传，中间几层组件得平白多背一个
 * 它们自己根本不关心的字段。
 *
 * 业务数据不走这里。跨页面的状态一律进 store，事件总线只传「这件事发生了」。
 */
import mitt, { type Emitter } from 'mitt'

type Events = {
  openSetting: void
  openSearchDialog: void
  openChat: void
  openLockScreen: void
}

const mittBus: Emitter<Events> = mitt<Events>()

export default mittBus
