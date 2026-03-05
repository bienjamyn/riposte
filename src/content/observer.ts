// Riposte Content Script — runs in isolated world
// Listens for postMessage from the MAIN world page-intercept script
// and forwards reply data to the service worker

// Navigate the X page when a suggestion is clicked in the sidebar iframe
window.addEventListener('message', (event) => {
  if (event.data?.type !== '__riposte_navigate__') return
  const url = event.data.url
  if (typeof url === 'string' && url.startsWith('https://x.com/')) {
    // Use a temporary <a> click so X's SPA router handles it (preserves DOM/sidebar)
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
})

window.addEventListener('message', (event) => {
  // Only accept messages from the same window (our page-intercept script)
  if (event.source !== window) return
  if (event.data?.type !== '__riposte_reply__') return

  const data = {
    repliedToUsername: event.data.repliedToUsername,
    repliedToDisplayName: event.data.repliedToDisplayName,
    repliedToTweetUrl: event.data.repliedToTweetUrl,
    replyText: event.data.replyText || '',
    originalTweetText: event.data.originalTweetText || '',
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

  // Close button — right arrows to suggest "slide away"
  const closeBtn = document.createElement('button')
  closeBtn.id = 'riposte-sidebar-close'
  closeBtn.innerHTML = '&rsaquo;&rsaquo;&rsaquo;'
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '10px',
    right: '10px',
    zIndex: '10001',
    height: '28px',
    padding: '0 8px',
    borderRadius: '14px',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#e7e9ea',
    fontSize: '16px',
    letterSpacing: '-2px',
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
    background: '#0C2026',
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
  sessionStorage.setItem('riposte-sidebar-open', sidebarVisible ? '1' : '')
  container.style.transform = sidebarVisible ? 'translateX(0)' : 'translateX(100%)'

  // Hide floating button when sidebar is open so it doesn't overlap
  const btn = document.getElementById('riposte-floating-btn')
  if (btn) btn.style.display = sidebarVisible ? 'none' : 'flex'
}

// Inject floating Riposte button into x.com page
function injectFloatingButton() {
  if (document.getElementById('riposte-floating-btn')) return

  const btn = document.createElement('button')
  btn.id = 'riposte-floating-btn'
  btn.title = 'Open Riposte'

  btn.innerHTML = `<img src="${chrome.runtime.getURL('public/icons/riposte-logo.png')}" width="32" height="32" alt="Riposte" style="image-rendering: auto;" />`

  Object.assign(btn.style, {
    position: 'fixed',
    top: '12px',
    right: '16px',
    zIndex: '10002',
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    transition: 'transform 0.15s',
  })

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.1)'
  })
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)'
  })

  btn.addEventListener('click', () => toggleSidebar())

  document.body.appendChild(btn)
}

if (document.body) {
  injectFloatingButton()
  startFeedScanner()
  if (sessionStorage.getItem('riposte-sidebar-open')) toggleSidebar(true)
} else {
  document.addEventListener('DOMContentLoaded', () => {
    injectFloatingButton()
    startFeedScanner()
    if (sessionStorage.getItem('riposte-sidebar-open')) toggleSidebar(true)
  })
}

// --- Feed Scanner: Highlight tweets matching interest profile ---

interface CachedProfile {
  topAccounts: { username: string; score: number }[]
  topKeywords: { word: string; score: number }[]
}

interface FeedSuggestion {
  authorUsername: string
  authorDisplayName: string
  tweetText: string
  tweetUrl: string
  matchReason: string
  score: number
  hasReplied: boolean
}

let cachedProfile: CachedProfile | null = null
let repliedTweetUrls = new Set<string>()
let loggedInUsername: string | null = null

function detectLoggedInUser(): string | null {
  const el = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
  if (!el) return null
  const spans = el.querySelectorAll('span')
  for (const span of spans) {
    const text = span.textContent?.trim()
    if (text?.startsWith('@')) return text.slice(1)
  }
  return null
}
const processedTweets = new WeakSet<Element>()
const currentSuggestions: FeedSuggestion[] = []

function tokenizeForScoring(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s@#]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
}

function scoreTweet(
  authorUsername: string,
  tweetText: string,
  profile: CachedProfile
): { score: number; reason: string } {
  // Account match: 0.6 weight
  const accountEntry = profile.topAccounts.find(
    (a) => a.username.toLowerCase() === authorUsername.toLowerCase()
  )
  const accountScore = accountEntry ? 0.6 * accountEntry.score : 0

  // Keyword overlap: 0.4 weight
  const tweetWords = new Set(tokenizeForScoring(tweetText))
  let keywordOverlap = 0
  let matchedKeywords: string[] = []
  for (const kw of profile.topKeywords) {
    if (tweetWords.has(kw.word)) {
      keywordOverlap += kw.score
      matchedKeywords.push(kw.word)
    }
  }
  // Scale: 3+ matched keywords = full keyword score
  const keywordScore = 0.4 * Math.min(matchedKeywords.length / 3, 1)

  const totalScore = accountScore + keywordScore

  // Build reason string
  const reasons: string[] = []
  if (accountEntry) reasons.push(`You often reply to @${authorUsername}`)
  if (matchedKeywords.length > 0) reasons.push(`Matches: ${matchedKeywords.slice(0, 3).join(', ')}`)
  const reason = reasons.join(' · ') || 'Matches your interests'

  return { score: totalScore, reason }
}

function createBadge(reason: string, hasReplied: boolean): HTMLElement {
  const badge = document.createElement('div')
  badge.className = 'riposte-suggestion-badge'
  badge.title = reason

  const fillColor = hasReplied ? '#00c853' : '#1D9BF0'
  const bgColor = hasReplied ? 'rgba(0,200,83,0.12)' : 'rgba(29,155,240,0.12)'

  badge.innerHTML = `<svg width="16" height="16" viewBox="0 0 250 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M38 15 h174 a38 38 0 0 1 38 38 v94 a38 38 0 0 1 -38 38 h-130 l-35 50 l-2 -50 h-7 a38 38 0 0 1 -38 -38 v-94 a38 38 0 0 1 38 -38z" fill="${fillColor}" stroke="none"/>
    <text x="125" y="135" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="110" fill="white">${hasReplied ? '✓' : 'R'}</text>
  </svg>`
  Object.assign(badge.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px 2px 4px',
    borderRadius: '12px',
    background: bgColor,
    color: fillColor,
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    marginLeft: '8px',
    verticalAlign: 'middle',
  })

  const label = document.createElement('span')
  label.textContent = hasReplied ? 'Replied' : 'Reply match'
  label.style.lineHeight = '16px'
  badge.appendChild(label)

  badge.addEventListener('click', (e) => {
    e.stopPropagation()
    toggleSidebar(true)
  })

  return badge
}

function scanTweet(article: Element) {
  if (processedTweets.has(article)) return
  processedTweets.add(article)

  if (!cachedProfile) return

  // Skip replies/comments — only suggest original posts
  const isReply = !!Array.from(article.querySelectorAll('span')).find(
    (el) => el.textContent?.trim() === 'Replying to'
  )
  if (isReply) return

  // Extract author username from the article
  const userLink = article.querySelector('a[href^="/"][role="link"]')
  if (!userLink) return
  const href = userLink.getAttribute('href') || ''
  const authorUsername = href.slice(1).split('/')[0]
  if (!authorUsername || authorUsername.includes(' ')) return

  // Skip own tweets
  if (loggedInUsername && authorUsername.toLowerCase() === loggedInUsername.toLowerCase()) return

  // Extract tweet text
  const tweetTextEl = article.querySelector('[data-testid="tweetText"]')
  const tweetText = tweetTextEl?.textContent || ''

  // Extract display name
  const displayNameEl = article.querySelector('[data-testid="User-Name"]')
  const authorDisplayName = displayNameEl?.querySelector('span')?.textContent || authorUsername

  // Extract tweet URL (needed for replied check and suggestions)
  const timeLink = article.querySelector('a[href*="/status/"] time')?.parentElement
  const tweetUrl = timeLink ? `https://x.com${timeLink.getAttribute('href')}` : ''

  // Score the tweet
  const { score, reason } = scoreTweet(authorUsername, tweetText, cachedProfile)

  if (score >= 0.15) {
    const hasReplied = repliedTweetUrls.has(tweetUrl)

    // Inject badge near the tweet's action bar
    const actionBar = article.querySelector('[role="group"]')
    if (actionBar && !actionBar.querySelector('.riposte-suggestion-badge')) {
      actionBar.appendChild(createBadge(reason, hasReplied))
    }

    // Add to suggestions list (keep max 20, deduplicate by URL)
    if (tweetUrl && !currentSuggestions.some((s) => s.tweetUrl === tweetUrl)) {
      currentSuggestions.push({
        authorUsername,
        authorDisplayName,
        tweetText: tweetText.slice(0, 200),
        tweetUrl,
        matchReason: reason,
        score,
        hasReplied,
      })
      // Keep only top 20 by score
      currentSuggestions.sort((a, b) => b.score - a.score)
      if (currentSuggestions.length > 20) currentSuggestions.length = 20

      // Report to service worker
      try {
        chrome.runtime.sendMessage({
          type: 'REPORT_SUGGESTIONS',
          data: currentSuggestions,
        })
      } catch { /* extension context invalidated */ }
    }
  }
}

async function loadInterestProfile() {
  try {
    const profile = await chrome.runtime.sendMessage({ type: 'GET_INTEREST_PROFILE' })
    if (profile && profile.topAccounts) {
      cachedProfile = profile
      console.log('[Riposte] Interest profile loaded:', profile.topAccounts.length, 'accounts,', profile.topKeywords.length, 'keywords')
    }
  } catch { /* extension context invalidated */ }
}

function rescanAllArticles() {
  document.querySelectorAll('article').forEach((article) => {
    processedTweets.delete(article)
    scanTweet(article)
  })
}

async function loadRepliedUrls() {
  try {
    const replies = await chrome.runtime.sendMessage({ type: 'GET_REPLIES' })
    if (Array.isArray(replies)) {
      repliedTweetUrls = new Set(replies.map((r: { repliedToTweetUrl: string }) => r.repliedToTweetUrl))
    }
  } catch { /* extension context invalidated */ }
}

async function startFeedScanner() {
  // Detect logged-in user — use MutationObserver to keep trying until nav renders
  loggedInUsername = detectLoggedInUser()
  if (loggedInUsername) {
    console.log('[Riposte] Logged-in user detected:', loggedInUsername)
  } else {
    const navObserver = new MutationObserver(() => {
      const found = detectLoggedInUser()
      if (found) {
        loggedInUsername = found
        console.log('[Riposte] Logged-in user detected:', loggedInUsername)
        navObserver.disconnect()
        rescanAllArticles()
      }
    })
    navObserver.observe(document.body, { childList: true, subtree: true })
  }

  // Await profile and replied URLs before scanning existing tweets
  await Promise.all([loadInterestProfile(), loadRepliedUrls()])

  // Listen for profile and reply updates — re-scan visible tweets when data changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.interestProfile?.newValue) {
      cachedProfile = changes.interestProfile.newValue
      console.log('[Riposte] Interest profile updated in content script')
      rescanAllArticles()
    }
    if (changes.replies) {
      loadRepliedUrls().then(() => rescanAllArticles())
    }
  })

  // Observe the feed for new tweets
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Check if it's a tweet article or contains tweet articles
          const articles = node.matches('article')
            ? [node]
            : Array.from(node.querySelectorAll('article'))
          for (const article of articles) {
            scanTweet(article)
          }
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Scan existing tweets on page (profile is loaded now)
  document.querySelectorAll('article').forEach(scanTweet)
}
