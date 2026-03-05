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

  if (message.type === 'GET_INTEREST_PROFILE') {
    getInterestProfile().then((profile) => sendResponse(profile))
    return true
  }

  if (message.type === 'REPORT_SUGGESTIONS') {
    // Content script reports matching tweets found in the feed
    chrome.storage.local.set({ feedSuggestions: message.data })
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'GET_SUGGESTIONS') {
    chrome.storage.local.get('feedSuggestions').then(({ feedSuggestions }) => {
      sendResponse(feedSuggestions || [])
    })
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
  replyText?: string
  originalTweetText?: string
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

  // Rebuild interest profile once we have enough data
  if (replies.length >= CALIBRATION_THRESHOLD) {
    await buildInterestProfile(replies as ReplyRecord[])
  }
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

// --- Interest Profile Engine ---

const CALIBRATION_THRESHOLD = 20

const STOP_WORDS = new Set([
  // Articles, prepositions, conjunctions
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor',
  'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all',
  'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only',
  'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when',
  'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
  'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him',
  'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their', 'up', 'about',
  // Common verbs and adverbs
  'also', 'like', 'get', 'got', 'go', 'going', 'know', 'think', 'make',
  'really', 'right', 'even', 'well', 'back', 'now', 'here', 'there',
  'much', 'many', 'still', 'already', 'way', 'thing', 'things', 'dont',
  "don't", 'im', "i'm", 'thats', "that's", 'its', "it's", 'http', 'https',
  // Common conversational words (not topically meaningful)
  'say', 'said', 'want', 'need', 'feel', 'look', 'come', 'take', 'give',
  'keep', 'let', 'put', 'tell', 'show', 'try', 'call', 'run', 'use',
  'turn', 'move', 'play', 'start', 'end', 'help', 'talk', 'point',
  'good', 'bad', 'new', 'old', 'big', 'long', 'high', 'great', 'best',
  'hard', 'real', 'last', 'first', 'next', 'sure', 'mean', 'live',
  'day', 'time', 'work', 'life', 'part', 'people', 'man', 'world',
  'sleep', 'stop', 'wait', 'read', 'left', 'hear', 'seen', 'done',
  // Social media filler
  'post', 'tweet', 'lol', 'lmao', 'yeah', 'nah', 'okay', 'yes',
  'literally', 'basically', 'actually', 'definitely', 'probably',
  // Pronouns and quantifiers
  'someone', 'something', 'everyone', 'everything', 'nothing', 'anything',
  'always', 'never', 'maybe', 'kind', 'lot', 'bit', 'stuff', 'whole',
])

const PROFILE_VERSION = 2

interface InterestProfile {
  topAccounts: { username: string; score: number }[]
  topKeywords: { word: string; score: number }[]
  calibratedAt: number
  replyCount: number
  profileVersion?: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s@#]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

async function buildInterestProfile(replies: ReplyRecord[]): Promise<InterestProfile> {
  // Account frequency scoring
  const accountCounts: Record<string, number> = {}
  for (const r of replies) {
    accountCounts[r.repliedToUsername] = (accountCounts[r.repliedToUsername] || 0) + 1
  }
  const maxAccountCount = Math.max(...Object.values(accountCounts), 1)
  const topAccounts = Object.entries(accountCounts)
    .map(([username, count]) => ({ username, score: count / maxAccountCount }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  // Keyword frequency scoring from the user's own reply text only
  const wordCounts: Record<string, number> = {}
  for (const r of replies) {
    const text = r.replyText || ''
    const words = tokenize(text)
    for (const w of words) {
      wordCounts[w] = (wordCounts[w] || 0) + 1
    }
  }
  const maxWordCount = Math.max(...Object.values(wordCounts), 1)
  const topKeywords = Object.entries(wordCounts)
    .filter(([, count]) => count >= 3) // only words that appear at least 3 times
    .map(([word, count]) => ({ word, score: count / maxWordCount }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)

  const profile: InterestProfile = {
    topAccounts,
    topKeywords,
    calibratedAt: Date.now(),
    replyCount: replies.length,
    profileVersion: PROFILE_VERSION,
  }

  await chrome.storage.local.set({ interestProfile: profile })
  console.log('[Riposte] Interest profile updated:', profile.topAccounts.length, 'accounts,', profile.topKeywords.length, 'keywords')
  return profile
}

async function getInterestProfile(): Promise<InterestProfile | null> {
  const { interestProfile, replies = [] } = await chrome.storage.local.get(['interestProfile', 'replies'])
  // Rebuild if profile is outdated or missing version
  if (interestProfile && interestProfile.profileVersion !== PROFILE_VERSION && (replies as ReplyRecord[]).length >= CALIBRATION_THRESHOLD) {
    return buildInterestProfile(replies as ReplyRecord[])
  }
  return interestProfile || null
}

console.log('[Riposte] Service worker loaded')
