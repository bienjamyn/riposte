import { useEffect, useState } from 'react'

interface Stats {
  total: number
  today: number
  last7Days: number
  streak: number
}

interface ReplyRecord {
  id: string
  repliedToUsername: string
  repliedToDisplayName: string
  repliedToTweetUrl: string
  timestamp: number
}

const DEFAULT_GOAL = 10

function getTodayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function App() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [replies, setReplies] = useState<ReplyRecord[]>([])
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_GOAL)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')

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
  }

  useEffect(() => {
    loadData()
    loadGoal()
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.replies) loadData()
      if (changes.dailyGoalWeek || changes.dailyGoalToday) loadGoal()
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const progress = stats ? Math.min(stats.today / dailyGoal, 1) : 0
  const isFull = stats ? stats.today >= dailyGoal : false

  return (
    <div className="app">
      <header>
        <h1>Riposte</h1>
        <p className="subtitle">Your reply game tracker</p>
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

          <section>
            <h2>Today's Replies</h2>
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
        </>
      ) : (
        <p className="loading">Loading stats...</p>
      )}
    </div>
  )
}

export default App
