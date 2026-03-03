# Changelog

All notable changes to Riposte will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-03-03

### Added

- Configurable daily reply goal with "Just Today" and "For the Week" scope options, persisted in chrome.storage.local
- Floating Riposte button on x.com pages (top-right corner) to open the side panel
- Extension icon is now greyed out and disabled on non-x.com tabs
- In-page sidebar injected into x.com (replaces Chrome Side Panel) with slide-in/out animation
- Grey icon variants for non-x.com tabs (visually distinct from the active blue icon)
- Close button on the in-page sidebar

### Changed

- Recent Replies feed now shows only today's replies, resetting at midnight to match the "Today" counter
- Sidebar is now an in-page iframe panel instead of Chrome's native Side Panel (no more pin/unpin chrome)
- Floating button toggles the in-page sidebar instead of opening Chrome's Side Panel
- Extension toolbar icon no longer opens a side panel on click
- Icon swaps between blue (x.com) and grey (other sites) using `setIcon` instead of relying on `enable`/`disable` opacity

### Removed

- Chrome Side Panel API dependency (`sidePanel` permission and `side_panel` manifest config)

## [0.1.0] - 2026-03-03

### Added

- Fetch interception to detect replies on X (formerly Twitter) — no API key needed
- Reply tracking with per-user analytics (today, this week, total, streak, leaderboard)
- Chrome Side Panel UI styled to match X's dark theme
- Badge counter on the extension icon
- Auto-reload of x.com tabs on extension install/update
- Error handling for invalidated extension context when the extension reloads
