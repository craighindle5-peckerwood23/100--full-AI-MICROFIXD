// Node's test runner uses separate processes. Finish extraction before any of
// them can launch the shared binary; its existence alone does not mean ready.
if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
  const {default: chromium} = await import('@sparticuz/chromium');
  await chromium.executablePath();
  console.log('Packaged Chromium ready for parallel browser tests.');
}
