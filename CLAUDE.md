# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Riposte

A Chrome Extension (Manifest V3) that tracks "reply guy" activity on X (formerly Twitter). It detects replies via fetch interception (no X API needed), stores analytics in `chrome.storage.local`, and displays stats in a Chrome Side Panel.

## Build & Dev Commands

```bash
npm run build        # TypeScript check + Vite build → outputs to dist/
npx vite build       # Vite build only (skips tsc, faster iteration)
npm run dev          # Vite dev server with HMR (CRXJS hot reload)
npm run lint         # ESLint
```

**To load in Chrome:** Build, then go to `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Architecture

Three execution contexts communicate via Chrome messaging:

1. **Content Script** (`src/content/observer.ts`) — Injected into x.com pages. Injects a page-level script into the main world that monkey-patches `window.fetch` to intercept `CreateTweet` GraphQL calls. When a reply is detected (has `in_reply_to_tweet_id`), it fires a `CustomEvent` which the content script forwards to the service worker via `chrome.runtime.sendMessage`.

2. **Service Worker** (`src/background/service-worker.ts`) — Receives `REPLY_DETECTED` messages, persists `ReplyRecord` objects to `chrome.storage.local`, computes stats (today/week/total/streak/leaderboard), and updates the badge. Also handles `GET_STATS` and `GET_REPLIES` messages from the sidebar.

3. **Sidebar** (`src/sidebar/`) — React app rendered in Chrome's Side Panel. Polls the service worker every 5 seconds for stats. Entry point is `src/sidebar/index.html` → `main.tsx` → `App.tsx`.

### Data flow

```
X page fetch → page-script intercept → CustomEvent → content script → chrome.runtime.sendMessage → service worker → chrome.storage.local
Sidebar poll → chrome.runtime.sendMessage(GET_STATS) → service worker reads storage → responds with stats
```

### Key types

`ReplyRecord` (defined in service-worker.ts): `{ id, repliedToUsername, repliedToDisplayName, repliedToTweetUrl, timestamp }`

## Important Patterns

- **Main world injection:** Content scripts run in an isolated world and can't intercept page fetch. The `pageScript` function is serialized via `.toString()` and injected as an inline `<script>` element into the page's main world.
- **No backend/API:** All data lives in `chrome.storage.local`. No X API calls — detection is purely client-side via DOM/fetch observation.
- **CRXJS Vite plugin** handles manifest processing, HMR for content scripts, and TypeScript compilation of extension entry points.
- The sidebar UI is styled to match X's dark theme (black background, `#1D9BF0` accent blue).
