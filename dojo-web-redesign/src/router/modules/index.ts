import { AppRouteRecord } from '@/types/router'
import { dojoRoutes } from './dojo'
import { exceptionRoutes } from './exception'

/**
 * Dojo 只注册业务菜单 + 异常页。
 * Art Design Pro 的 dashboard/template/widgets/examples 等演示模块全部移除。
 */
export const routeModules: AppRouteRecord[] = [...dojoRoutes, exceptionRoutes]
