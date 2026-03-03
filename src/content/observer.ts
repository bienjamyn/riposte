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

  try {
    chrome.runtime.sendMessage({
      type: 'REPLY_DETECTED',
      data,
    })
  } catch {
    // Extension context invalidated — user reloaded extension but hasn't refreshed this tab
  }
})

console.log('[Riposte] Content script loaded — monitoring replies on x.com')

// Inject floating Riposte button into x.com page
function injectFloatingButton() {
  if (document.getElementById('riposte-floating-btn')) return

  const btn = document.createElement('button')
  btn.id = 'riposte-floating-btn'
  btn.title = 'Open Riposte'

  const iconUrl = chrome.runtime.getURL('public/icons/icon48.png')
  btn.innerHTML = `<img src="${iconUrl}" width="24" height="24" alt="Riposte" style="border-radius: 50%;" />`

  Object.assign(btn.style, {
    position: 'fixed',
    top: '12px',
    right: '16px',
    zIndex: '9999',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: '1px solid #2f3336',
    background: '#16181c',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    transition: 'background 0.2s, transform 0.15s',
  })

  btn.addEventListener('mouseenter', () => {
    btn.style.background = '#1d9bf0'
    btn.style.transform = 'scale(1.1)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#16181c'
    btn.style.transform = 'scale(1)'
  })

  btn.addEventListener('click', () => {
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' })
    } catch {
      // Extension context invalidated
    }
  })

  document.body.appendChild(btn)
}

if (document.body) {
  injectFloatingButton()
} else {
  document.addEventListener('DOMContentLoaded', injectFloatingButton)
}
