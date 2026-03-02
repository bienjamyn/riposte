// Riposte Content Script — runs in isolated world
// Listens for postMessage from the MAIN world page-intercept script
// and forwards reply data to the service worker

window.addEventListener('message', (event) => {
  // Only accept messages from the same window (our page-intercept script)
  if (event.source !== window) return
  if (event.data?.type !== '__riposte_reply__') return

  const data = {
    repliedToUsername: event.data.repliedToUsername,
    repliedToDisplayName: event.data.repliedToDisplayName,
    repliedToTweetUrl: event.data.repliedToTweetUrl,
    timestamp: event.data.timestamp,
  }

  console.log('[Riposte] Reply detected!', data)

  chrome.runtime.sendMessage({
    type: 'REPLY_DETECTED',
    data,
  })
})

console.log('[Riposte] Content script loaded — monitoring replies on x.com')
