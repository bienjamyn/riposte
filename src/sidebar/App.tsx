import { useEffect, useState } from 'react'

interface Stats {
  total: number
  today: number
  last7Days: number
  streak: number
  leaderboard: { username: string; displayName: string; count: number }[]
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null)

  const loadStats = () => {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
      if (response) setStats(response)
    })
  }

  useEffect(() => {
    loadStats()
    // Instant update when storage changes (reply saved by service worker)
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.replies) loadStats()
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return (
    <div className="app">
      <header>
        <h1>Riposte</h1>
        <p className="subtitle">Your reply game tracker</p>
      </header>

      {stats ? (
        <>
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
            <h2>Top Accounts</h2>
            {stats.leaderboard.length === 0 ? (
              <p className="empty">No replies tracked yet. Start replying!</p>
            ) : (
              <ul className="leaderboard">
                {stats.leaderboard.slice(0, 10).map((account) => (
                  <li key={account.username}>
                    <a
                      href={`https://x.com/${account.username}`}
                      target="_blank"
                      rel="noopener"
                    >
                      <span className="account-name">
                        {account.displayName}
                      </span>
                      <span className="account-handle">
                        @{account.username}
                      </span>
                    </a>
                    <span className="reply-count">{account.count}</span>
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
