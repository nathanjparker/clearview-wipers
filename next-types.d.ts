// Workaround for Next.js 16 generated types that reference next/types.js
declare module "next/types.js" {
  export type ResolvingMetadata = (...args: unknown[]) => Promise<unknown> | unknown;
  export type ResolvingViewport = (...args: unknown[]) => Promise<unknown> | unknown;
}
