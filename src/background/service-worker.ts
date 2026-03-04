// Riposte Service Worker — handles storage and badge updates

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REPLY_DETECTED') {
    handleReplyDetected(message.data).then(() => sendResponse({ ok: true }))
    return true // keep channel open for async response
  }

  if (message.type === 'GET_STATS') {
    getStats().then((stats) => sendResponse(stats))
    return true
  }

  if (message.type === 'GET_REPLIES') {
    getReplies().then((replies) => sendResponse(replies))
    return true
  }

})

// Disable action by default — only enable on x.com tabs
chrome.action.disable()

function isXUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    return new URL(url).hostname === 'x.com'
  } catch {
    return false
  }
}

function updateIconForTab(tabId: number, url: string | undefined) {
  if (isXUrl(url)) {
    chrome.action.setIcon({
      tabId,
      path: { '16': 'public/icons/icon16.png', '32': 'public/icons/icon32.png', '48': 'public/icons/icon48.png' },
    })
    chrome.action.enable(tabId)
  } else {
    chrome.action.setIcon({
      tabId,
      path: { '16': 'public/icons/icon16-grey.png', '32': 'public/icons/icon32-grey.png', '48': 'public/icons/icon48-grey.png' },
    })
    chrome.action.disable(tabId)
  }
}

// Enable/disable icon as tabs change
chrome.tabs.onUpdated.addListener((tabId, _changeInfo, tab) => {
  updateIconForTab(tabId, tab.url)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  updateIconForTab(activeInfo.tabId, tab.url)
})

// Set correct icon state for all tabs and reload x.com tabs on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id) {
      updateIconForTab(tab.id, tab.url)
      if (isXUrl(tab.url)) chrome.tabs.reload(tab.id)
    }
  }
})


interface ReplyRecord {
  id: string
  repliedToUsername: string
  repliedToDisplayName: string
  repliedToTweetUrl: string
  timestamp: number
}

async function handleReplyDetected(data: Omit<ReplyRecord, 'id'>) {
  const record: ReplyRecord = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }

  const { replies = [] } = await chrome.storage.local.get('replies')
  replies.push(record)
  await chrome.storage.local.set({ replies })

  // Update badge with today's count
  const todayCount = replies.filter((r: ReplyRecord) => {
    const today = new Date()
    const replyDate = new Date(r.timestamp)
    return (
      replyDate.getDate() === today.getDate() &&
      replyDate.getMonth() === today.getMonth() &&
      replyDate.getFullYear() === today.getFullYear()
    )
  }).length

  chrome.action.setBadgeText({ text: todayCount.toString() })
  chrome.action.setBadgeBackgroundColor({ color: '#00C853' })

  console.log('[Riposte] Reply saved:', record)
}

async function getStats() {
  const { replies = [] } = await chrome.storage.local.get('replies')
  const now = new Date()

  const todayReplies = replies.filter((r: ReplyRecord) => {
    const d = new Date(r.timestamp)
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    )
  })

  const last7Days = replies.filter((r: ReplyRecord) => {
    return now.getTime() - r.timestamp < 7 * 24 * 60 * 60 * 1000
  })

  // Account leaderboard
  const accountCounts: Record<string, { username: string; displayName: string; count: number }> = {}
  for (const r of replies as ReplyRecord[]) {
    if (!accountCounts[r.repliedToUsername]) {
      accountCounts[r.repliedToUsername] = {
        username: r.repliedToUsername,
        displayName: r.repliedToDisplayName,
        count: 0,
      }
    }
    accountCounts[r.repliedToUsername].count++
  }

  const leaderboard = Object.values(accountCounts).sort((a, b) => b.count - a.count)

  // Streak calculation
  const streak = calculateStreak(replies as ReplyRecord[])

  return {
    total: replies.length,
    today: todayReplies.length,
    last7Days: last7Days.length,
    streak,
    leaderboard,
  }
}

function calculateStreak(replies: ReplyRecord[]): number {
  if (replies.length === 0) return 0

  const days = new Set(
    replies.map((r) => {
      const d = new Date(r.timestamp)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  let streak = 0
  const now = new Date()
  const check = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  while (true) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`
    if (days.has(key)) {
      streak++
      check.setDate(check.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

async function getReplies(): Promise<ReplyRecord[]> {
  const { replies = [] } = await chrome.storage.local.get('replies')
  return (replies as ReplyRecord[]).sort((a, b) => b.timestamp - a.timestamp)
}

console.log('[Riposte] Service worker loaded')
