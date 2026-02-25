# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static frontend web application styled as a retro cyberpunk/CRT terminal interface. There is no build system, bundler, or package manager — the app is plain HTML/CSS/JS served directly from the filesystem or any static file server.

## Running Locally

Open `index.html` in a browser. No build step required.

## Backend Dependency

The frontend expects a .NET backend API running at `http://localhost:12410` with these endpoints:
- `GET /api/Ping` — health check (returns `{ status: "alive" }`)
- `POST /api/Login` — authentication (accepts `{ username, password }`, returns `{ token, user }`)
- `POST /api/User/account` — registration (accepts `{ username, password, email, firstName, lastName }`)

The status bar polls `/api/Ping` every 15 seconds and shows SYSTEM READY / NOT READY / OFFLINE accordingly. The health toggle in Settings controls this polling.

## Architecture

This is a single-page app with three files and no dependencies beyond Google Fonts (VT323, IBM Plex Mono):

- **`index.html`** — All UI structure: login form, toolbar, games panel (tic-tac-toe), settings panel, help modal, registration modal. Panels are toggled via `style.display` in JS.
- **`script.js`** — All application logic in a single file, organized into sections:
  - Health-check polling (`checkPingStatus`, `setHealthMonitoring`)
  - Typing animation for the welcome message
  - Login/registration form handling with fetch calls to the backend
  - Toolbar and panel management (`showGamesPanel`, `showSettingsPanel`, `hidePanels`)
  - Tic-tac-toe game with minimax AI (`getBestMove`, `minimax`)
  - Notification system (`showError`, `showSuccess`, `createNotification`)
  - Konami code easter egg
- **`styles.css`** — Full styling with CSS custom properties in `:root`. Key theme variables: `--color-primary` (cyan), `--color-secondary` (magenta), `--color-accent` (green), `--color-bg`, `--color-surface`. CRT/scanline effects, glitch animations, and glow effects are all CSS-based.

## UI State Flow

1. **Login screen** — shown on load; typing animation plays the welcome message, then the login form fades in
2. **Post-login** — login form hides, container expands to full viewport, toolbar appears with HOME, DASHBOARD, SETTINGS, GAMES, HELP buttons
3. **Panels** — Settings and Games are mutually exclusive sidebar+content panels within the terminal window; HOME/DASHBOARD hide both panels

## Key Patterns

- No framework — vanilla DOM manipulation with `getElementById`/`querySelector` and inline `style.display` toggling
- Auth token stored in `localStorage` under key `authToken`
- Notifications are ephemeral DOM elements appended to `<body>` with inline styles and auto-removed after 3 seconds
- The SVG logo in `index.html` uses inline SVG filters (`feGaussianBlur`, `feMerge`) for glow effects
