/// <reference types="vite/client" />

// 这两个包没带类型声明，补个空模块让 TS 闭嘴
declare module 'nprogress'

declare module 'crypto-js'

// vite define 注入，来源是 .env 里的 VITE_VERSION
declare const __APP_VERSION__: string
