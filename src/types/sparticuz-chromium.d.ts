declare module '@sparticuz/chromium' {
  const chromium: {
    readonly args: string[];
    executablePath(): Promise<string>;
  };
  export default chromium;
}
