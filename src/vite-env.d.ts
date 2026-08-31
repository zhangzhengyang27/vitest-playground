/// <reference types="vite/client" />

declare module '*.less?modules' {
  const classes: Record<string, string>;
  export default classes;
}
