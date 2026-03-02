# Riposte

A Chrome extension that tracks your "reply guy" activity on X (Twitter). Monitor your replies, see which accounts you engage with most, and build streaks.

## Features

- **Reply Tracking** — Automatically detects when you reply to tweets and logs who you replied to, when, and where
- **Account Leaderboard** — See which accounts you reply to most, sorted by count
- **Stats Dashboard** — Today's replies, weekly count, all-time total at a glance
- **Streak Tracking** — Track consecutive days of reply activity
- **Instant Updates** — Sidebar refreshes the moment you post a reply
- **AI Reply Suggestions** — *(Coming soon)* Get contextual reply suggestions powered by Claude

## How It Works

Riposte runs entirely in your browser. It intercepts X's internal API calls to detect when you post a reply, then stores that data locally using `chrome.storage.local`. No data leaves your machine, no X API key required, no backend server.

The extension uses Chrome's Side Panel API to display your analytics dashboard alongside X.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/bienjamyn/riposte.git
cd riposte

# Install dependencies
npm install

# Build the extension
npx vite build
```

Then load it in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Navigate to x.com and click the Riposte icon to open the side panel

## Tech Stack

- **Chrome Extension** (Manifest V3)
- **TypeScript** + **React**
- **Vite** + **CRXJS** for building
- **chrome.storage.local** for persistence

## License

MIT
