import { useEffect, useState } from 'react'

interface Stats {
  total: number
  today: number
  last7Days: number
  streak: number
  leaderboard: { username: string; displayName: string; count: number }[]
}

interface ReplyRecord {
  id: string
  repliedToUsername: string
  repliedToDisplayName: string
  repliedToTweetUrl: string
  timestamp: number
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

interface InterestProfile {
  topAccounts: { username: string; score: number }[]
  topKeywords: { word: string; score: number }[]
  calibratedAt: number
  replyCount: number
}

const DEFAULT_GOAL = 10
const CALIBRATION_THRESHOLD = 20

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getDailyCounts(replies: ReplyRecord[], from: string, to: string): { date: string; count: number }[] {
  // Count replies per day
  const counts: Record<string, number> = {}
  for (const r of replies) {
    const d = new Date(r.timestamp)
    const key = getDateString(d)
    counts[key] = (counts[key] || 0) + 1
  }

  // Fill in every day in the range
  const result: { date: string; count: number }[] = []
  const current = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (current <= end) {
    const key = getDateString(current)
    result.push({ date: key, count: counts[key] || 0 })
    current.setDate(current.getDate() + 1)
  }
  return result
}

function LineChart({ data, maxCount }: { data: { date: string; count: number }[]; maxCount: number }) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (data.length === 0) return <p className="empty">No data for this range.</p>

  const width = 320
  const height = 160
  const padL = 12
  const padR = 12
  const padT = 28
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const points = data.map((d, i) => ({
    x: padL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2),
    y: padT + plotH - (maxCount > 0 ? (d.count / maxCount) * plotH : 0),
    ...d,
  }))

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  // X-axis labels: show first, middle, last
  const labelIndices: number[] = []
  if (data.length >= 1) labelIndices.push(0)
  if (data.length >= 3) labelIndices.push(Math.floor(data.length / 2))
  if (data.length >= 2) labelIndices.push(data.length - 1)

  // Y-axis grid: 0 and max
  const gridYValues = maxCount > 0 ? [0, Math.ceil(maxCount / 2), maxCount] : [0]

  const hp = hovered !== null ? points[hovered] : null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
      {/* Grid lines */}
      {gridYValues.map((v) => {
        const y = padT + plotH - (maxCount > 0 ? (v / maxCount) * plotH : 0)
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#2f3336" strokeWidth="1" />
            <text x={padL - 2} y={y - 4} fill="#71767b" fontSize="9" textAnchor="end">
              {v}
            </text>
          </g>
        )
      })}
      {/* Area fill */}
      <polygon
        points={`${points[0].x},${padT + plotH} ${polyline} ${points[points.length - 1].x},${padT + plotH}`}
        fill="url(#areaGradient)"
      />
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00e676" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00e676" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Line */}
      <polyline points={polyline} fill="none" stroke="#00e676" strokeWidth="2" strokeLinejoin="round" />
      {/* Vertical hover line */}
      {hp && (
        <line x1={hp.x} y1={padT} x2={hp.x} y2={padT + plotH} stroke="#71767b" strokeWidth="1" strokeDasharray="3,3" />
      )}
      {/* Data points */}
      {points.map((p, i) => (
        <g
          key={p.date}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
          <circle
            cx={p.x}
            cy={p.y}
            r={hovered === i ? 5 : 3}
            fill={hovered === i ? '#fff' : '#00e676'}
            stroke="#00e676"
            strokeWidth="2"
          />
        </g>
      ))}
      {/* Tooltip */}
      {hp && (
        <g>
          <rect
            x={Math.min(hp.x - 40, width - padR - 80)}
            y={hp.y - 36}
            width="80"
            height="24"
            rx="4"
            fill="#1a1a2e"
            stroke="#2f3336"
            strokeWidth="1"
          />
          <text
            x={Math.min(hp.x, width - padR - 40)}
            y={hp.y - 20}
            fill="#e7e9ea"
            fontSize="11"
            textAnchor="middle"
            fontWeight="600"
          >
            {formatShortDate(hp.date)}: {hp.count}
          </text>
        </g>
      )}
      {/* X-axis labels */}
      {labelIndices.map((i) => (
        <text
          key={points[i].date}
          x={points[i].x}
          y={height - 6}
          fill="#71767b"
          fontSize="10"
          textAnchor="middle"
        >
          {formatShortDate(points[i].date)}
        </text>
      ))}
    </svg>
  )
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [replies, setReplies] = useState<ReplyRecord[]>([])
  const [allReplies, setAllReplies] = useState<ReplyRecord[]>([])
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [tab, setTab] = useState<'replies' | 'analytics' | 'suggestions'>('replies')
  const [suggestions, setSuggestions] = useState<FeedSuggestion[]>([])
  const [interestProfile, setInterestProfile] = useState<InterestProfile | null>(null)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return getDateString(d)
  })
  const [dateTo, setDateTo] = useState(() => getDateString(new Date()))

  const loadGoal = () => {
    chrome.storage.local.get(['dailyGoalWeek', 'dailyGoalToday'], (result) => {
      const today = getTodayString()
      if (result.dailyGoalToday && result.dailyGoalToday.date === today) {
        setDailyGoal(result.dailyGoalToday.value)
      } else if (result.dailyGoalWeek) {
        setDailyGoal(result.dailyGoalWeek)
      } else {
        setDailyGoal(DEFAULT_GOAL)
      }
    })
  }

  const saveGoal = (scope: 'today' | 'week') => {
    const value = Math.max(1, parseInt(goalInput) || DEFAULT_GOAL)
    if (scope === 'today') {
      chrome.storage.local.set({ dailyGoalToday: { value, date: getTodayString() } })
    } else {
      chrome.storage.local.set({ dailyGoalWeek: value })
    }
    setDailyGoal(value)
    setIsEditingGoal(false)
  }

  const loadData = () => {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
      if (response) setStats(response)
    })
    chrome.runtime.sendMessage({ type: 'GET_REPLIES' }, (response) => {
      if (response) {
        setAllReplies(response)
        const now = new Date()
        const todayReplies = response.filter((r: ReplyRecord) => {
          const d = new Date(r.timestamp)
          return (
            d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
          )
        })
        setReplies(todayReplies)
      }
    })
    chrome.runtime.sendMessage({ type: 'GET_SUGGESTIONS' }, (response) => {
      if (response) setSuggestions(response)
    })
    chrome.runtime.sendMessage({ type: 'GET_INTEREST_PROFILE' }, (response) => {
      if (response) setInterestProfile(response)
    })
  }

  useEffect(() => {
    loadData()
    loadGoal()
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.replies) loadData()
      if (changes.dailyGoalWeek || changes.dailyGoalToday) loadGoal()
      if (changes.feedSuggestions?.newValue) setSuggestions(changes.feedSuggestions.newValue)
      if (changes.interestProfile?.newValue) setInterestProfile(changes.interestProfile.newValue)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const progress = stats ? Math.min(stats.today / dailyGoal, 1) : 0
  const isFull = stats ? stats.today >= dailyGoal : false

  const dailyCounts = getDailyCounts(allReplies, dateFrom, dateTo)
  const maxCount = Math.max(...dailyCounts.map((d) => d.count), 1)

  // Analytics computations
  const uniqueAccounts = new Set(allReplies.map((r) => r.repliedToUsername)).size
  const daysActive = new Set(allReplies.map((r) => getDateString(new Date(r.timestamp)))).size
  const avgPerDay = daysActive > 0 ? (allReplies.length / daysActive).toFixed(1) : '0'

  const peakHour = (() => {
    if (allReplies.length === 0) return '--'
    const hourCounts = new Array(24).fill(0)
    for (const r of allReplies) hourCounts[new Date(r.timestamp).getHours()]++
    const maxH = hourCounts.indexOf(Math.max(...hourCounts))
    const fmt = (h: number) => {
      const suffix = h >= 12 ? 'PM' : 'AM'
      const hr = h % 12 || 12
      return `${hr}${suffix}`
    }
    return `${fmt(maxH)}-${fmt((maxH + 1) % 24)}`
  })()

  return (
    <div className="app">
      <header>
        <h1>Riposte</h1>
        <p className="subtitle">Track your replies, build relationships, and grow on X.</p>
      </header>

      {stats ? (
        <>
          <div className="progress-section">
            <div className={`progress-bar-track${isFull ? ' full' : ''}`}>
              <div
                className="progress-bar-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="progress-label">
              {stats.today} / {dailyGoal} replies today
              {isFull && ' — Goal reached!'}
            </p>
            <div className="goal-row">
              {isEditingGoal ? (
                <>
                  <input
                    className="goal-input"
                    type="number"
                    min="1"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    autoFocus
                  />
                  <button className="goal-scope-btn" onClick={() => saveGoal('today')}>
                    Just Today
                  </button>
                  <button className="goal-scope-btn" onClick={() => saveGoal('week')}>
                    For the Week
                  </button>
                </>
              ) : (
                <button
                  className="goal-btn"
                  onClick={() => {
                    setGoalInput(String(dailyGoal))
                    setIsEditingGoal(true)
                  }}
                >
                  Set Goal
                </button>
              )}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{stats.today}</span>
              <span className="stat-label">Today</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.last7Days}</span>
              <span className="stat-label">This Week</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">All Time</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.streak}</span>
              <span className="stat-label">Day Streak</span>
            </div>
          </div>

          <div className="tab-bar">
            <button
              className={`tab-btn${tab === 'replies' ? ' active' : ''}`}
              onClick={() => setTab('replies')}
            >
              Today's Replies
            </button>
            <button
              className={`tab-btn${tab === 'analytics' ? ' active' : ''}`}
              onClick={() => setTab('analytics')}
            >
              Analytics
            </button>
            <button
              className={`tab-btn${tab === 'suggestions' ? ' active' : ''}`}
              onClick={() => setTab('suggestions')}
            >
              Suggestions
            </button>
          </div>

          {tab === 'replies' && (
            <section>
              {replies.length === 0 ? (
                <p className="empty">No replies today yet. Start replying!</p>
              ) : (
                <ul className="recent-replies">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <a
                        href={reply.repliedToTweetUrl || `https://x.com/${reply.repliedToUsername}`}
                        target="_blank"
                        rel="noopener"
                      >
                        <span className="account-name">
                          {reply.repliedToDisplayName}
                        </span>
                        <span className="account-handle">
                          @{reply.repliedToUsername}
                        </span>
                      </a>
                      <span className="reply-time">{timeAgo(reply.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'analytics' && (
            <section>
              <div className="date-filter">
                <label>
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>
              <LineChart data={dailyCounts} maxCount={maxCount} />

              <div className="analytics-stats">
                <div className="stat-card">
                  <span className="stat-value">{avgPerDay}</span>
                  <span className="stat-label">Avg/Day</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{uniqueAccounts}</span>
                  <span className="stat-label">Unique Accounts</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{peakHour}</span>
                  <span className="stat-label">Peak Hour</span>
                </div>
              </div>

              {stats.leaderboard && stats.leaderboard.length > 0 && (
                <div className="leaderboard">
                  <h3 className="leaderboard-title">Top Accounts</h3>
                  <ul className="recent-replies">
                    {stats.leaderboard.slice(0, 5).map((entry, i) => (
                      <li key={entry.username} className="leaderboard-item">
                        <span className="leaderboard-rank">#{i + 1}</span>
                        <div className="leaderboard-info">
                          <span className="account-name">{entry.displayName}</span>
                          <span className="account-handle">@{entry.username}</span>
                        </div>
                        <span className="leaderboard-count">{entry.count} replies</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {tab === 'suggestions' && (
            <section>
              {!interestProfile ? (
                <div className="calibration-progress">
                  <p className="calibration-title">Learning your patterns...</p>
                  <div className="progress-bar-track">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min((allReplies.length / CALIBRATION_THRESHOLD) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="calibration-count">
                    {allReplies.length} / {CALIBRATION_THRESHOLD} replies collected
                  </p>
                  <p className="empty">
                    Keep replying! Riposte needs {Math.max(CALIBRATION_THRESHOLD - allReplies.length, 0)} more replies to start suggesting tweets that match your interests.
                  </p>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="suggestions-empty">
                  <p className="empty">No matching tweets found in your current feed. Keep scrolling — suggestions will appear as you browse.</p>
                  <p className="calibration-count" style={{ marginTop: '12px' }}>
                    Profile built from {interestProfile.replyCount} replies
                  </p>
                </div>
              ) : (
                <>
                  <p className="calibration-count" style={{ marginBottom: '8px' }}>
                    {suggestions.length} tweet{suggestions.length !== 1 ? 's' : ''} matching your interests
                  </p>
                  <ul className="recent-replies">
                    {suggestions.map((s, i) => (
                      <li key={`${s.tweetUrl}-${i}`} className={`suggestion-item${s.hasReplied ? ' suggestion-replied' : ''}`}>
                        <div className="suggestion-header">
                          <a
                            href={s.tweetUrl}
                            onClick={(e) => {
                              e.preventDefault()
                              window.parent.postMessage(
                                { type: '__riposte_navigate__', url: s.tweetUrl },
                                'https://x.com'
                              )
                            }}
                          >
                            <span className="account-name">{s.authorDisplayName}</span>
                            <span className="account-handle">@{s.authorUsername}</span>
                          </a>
                          <span className={`suggestion-status ${s.hasReplied ? 'status-replied' : 'status-match'}`}>
                            {s.hasReplied ? 'Replied' : 'Reply match'}
                          </span>
                        </div>
                        <p className="suggestion-text">{s.tweetText}</p>
                        <span className="suggestion-reason">{s.matchReason}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
        </>
      ) : (
        <p className="loading">Loading stats...</p>
      )}
    </div>
  )
}

export default App
