# MineCtrl

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **A lightweight web dashboard for managing and monitoring Minecraft servers — no bloat, no fuss.**

MineCtrl gives you real-time server visibility and control through a clean browser interface. It's built to be fast to deploy, easy to extend, and light on resources — so it doesn't compete with your server for RAM.

---

## Features

- **Real-time monitoring** — Server status, player counts, and live feedback at a glance
- **Lightweight backend** — Node.js with minimal dependencies; doesn't eat into your server's headroom
- **Simple authentication** — Local `Users.json`-based user management, no database required
- **Modern interface** — Clean, responsive web dashboard that works in any browser
- **Fast setup** — Running in under five minutes from a fresh clone

---

## Requirements

- [Node.js](https://nodejs.org/) v16 or higher
- npm (bundled with Node.js)

---

## Getting Started

**1. Clone the repository**

```bash
git clone https://github.com/reyaansh72/MineCtrl.git
cd MineCtrl
```

**2. Install dependencies**

```bash
npm install express cors
```

**3. Start the server**

```bash
node server.js
```

**4. Open the dashboard**

Navigate to `http://localhost:3000` in your browser. That's it.

---

## Project Structure

```
MineCtrl/
├── server.js       # Main application entry point
├── package.json    # Project metadata and dependencies
└── Users.json      # Local user store
```

---

## Development Mode

To automatically restart the server when you save changes, use `nodemon`:

```bash
npx nodemon server.js
```

Install it globally once if you prefer the shorter command:

```bash
npm install -g nodemon
```

---

## Notes

- **Port:** Defaults to `3000`. Change it in `server.js` if another service is already using that port.
- **User data:** Credentials and settings are stored in `Users.json` — keep this file out of version control if your repo is public.

---

## Author

**Reyaansh** · [@reyaansh72](https://github.com/reyaansh72)

---

*Made with ❤️ for the Minecraft community.*
