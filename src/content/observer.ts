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

// --- In-page sidebar ---

let sidebarVisible = false

function createSidebar(): HTMLDivElement {
  const container = document.createElement('div')
  container.id = 'riposte-sidebar'

  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '380px',
    height: '100vh',
    zIndex: '10000',
    transform: 'translateX(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
    borderLeft: '1px solid #2f3336',
    overflow: 'hidden',
  })

  // Close button
  const closeBtn = document.createElement('button')
  closeBtn.id = 'riposte-sidebar-close'
  closeBtn.innerHTML = '&#x2715;' // ✕
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: '10001',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#e7e9ea',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  })
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.16)'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.background = 'rgba(255,255,255,0.08)'
  })
  closeBtn.addEventListener('click', () => toggleSidebar(false))

  // Iframe loading the sidebar React app
  const iframe = document.createElement('iframe')
  iframe.src = chrome.runtime.getURL('src/sidebar/index.html')
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#000',
  })

  container.appendChild(closeBtn)
  container.appendChild(iframe)
  document.body.appendChild(container)

  return container
}

function toggleSidebar(forceState?: boolean) {
  let container = document.getElementById('riposte-sidebar') as HTMLDivElement | null
  if (!container) {
    container = createSidebar()
  }

  sidebarVisible = forceState !== undefined ? forceState : !sidebarVisible
  container.style.transform = sidebarVisible ? 'translateX(0)' : 'translateX(100%)'
}

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
    zIndex: '10002',
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

  btn.addEventListener('click', () => toggleSidebar())

  document.body.appendChild(btn)
}

if (document.body) {
  injectFloatingButton()
} else {
  document.addEventListener('DOMContentLoaded', injectFloatingButton)
}
