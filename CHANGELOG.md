# Changelog

All notable changes to Riposte will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.3] - 2026-03-04

### Added

- Interest profile engine — analyses your reply history to learn which accounts and topics you engage with most
- Feed scanner — highlights tweets in your feed that match your interest profile with a "Reply match" badge
- Suggestions tab in the sidebar — shows matching tweets from your feed, clickable to navigate directly
- Analytics tab — avg replies/day, unique accounts replied to, peak reply hour, and top accounts leaderboard
- Calibration progress UI — shows how many more replies are needed before suggestions activate (20 replies)
- Reply text and original tweet text are now captured for smarter interest profiling
- Sidebar persists across page navigations within x.com (sessionStorage)
- In-page SPA navigation when clicking suggestions (no full reload)

### Fixed

- Own tweets and comments no longer appear in suggestions — logged-in user detection now uses a persistent MutationObserver instead of a single retry, and rescans all articles once detected

### Changed

- "Overview" tab renamed to "Analytics" with richer stats
- Floating button now uses the Riposte logo

## [0.1.1] - 2026-03-03

### Added

- Configurable daily reply goal with "Just Today" and "For the Week" scope options, persisted in chrome.storage.local
- Floating Riposte button on x.com pages (top-right corner) to open the side panel
- Extension icon is now greyed out and disabled on non-x.com tabs
- In-page sidebar injected into x.com (replaces Chrome Side Panel) with slide-in/out animation
- Grey icon variants for non-x.com tabs (visually distinct from the active blue icon)
- Close button on the in-page sidebar
- Interactive SVG line chart in the Overview tab with hover tooltips showing date and reply count
- Popup page for the extension toolbar icon

### Changed

- Recent Replies feed now shows only today's replies, resetting at midnight to match the "Today" counter
- Sidebar is now an in-page iframe panel instead of Chrome's native Side Panel (no more pin/unpin chrome)
- Floating button toggles the in-page sidebar instead of opening Chrome's Side Panel
- Extension toolbar icon no longer opens a side panel on click
- Icon swaps between blue (x.com) and grey (other sites) using `setIcon` instead of relying on `enable`/`disable` opacity
- Floating button now uses high-resolution icon (128px source) for crisp rendering on Retina/high-DPI displays
- Updated sidebar subtitle to "Track your replies, build relationships, and grow on X."
- Replaced horizontal bar chart with interactive line chart featuring area fill, grid lines, and hover tooltips

### Removed

- Chrome Side Panel API dependency (`sidePanel` permission and `side_panel` manifest config)

## [0.1.0] - 2026-03-02

### Added

- Fetch interception to detect replies on X (formerly Twitter) — no API key needed
- Reply tracking with per-user analytics (today, this week, total, streak, leaderboard)
- Chrome Side Panel UI styled to match X's dark theme
- Badge counter on the extension icon
- Auto-reload of x.com tabs on extension install/update
- Error handling for invalidated extension context when the extension reloads
