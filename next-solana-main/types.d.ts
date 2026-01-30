declare module 'groq-sdk'
declare module 'winston'
declare module 'swr'
// telegraf internal type path sometimes used in code
declare module 'telegraf/typings/core/types/typegram' {
  export * from 'telegraf'
}

// Minimal winston Logger shape used across the repo
declare module 'winston' {
  export interface Logger {
    info(message: string, ...meta: any[]): void
    warn(message: string, ...meta: any[]): void
    error(message: string, ...meta: any[]): void
    debug?(message: string, ...meta: any[]): void
  }
  const winston: { createLogger?: (opts?: any) => Logger }
  export default winston
}
