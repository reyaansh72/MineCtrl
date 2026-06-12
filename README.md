# 🎮 MineCtrl

[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **A lightweight, modern Minecraft Server Dashboard built with Node.js 🚀**

MineCtrl is a fast, web-based control panel designed for managing and monitoring Minecraft servers with ease. Built to be resource-efficient, easy to deploy, and fully customizable.

---

## ✨ Features

* **📊 Real-Time Monitoring:** Keep track of your server status at a glance.
* **⚡ Lightweight Backend:** Powered by a fast and efficient Node.js architecture.
* **👥 Simple Authentication:** Straightforward user management via a local `Users.json` file.
* **🎨 Modern Interface:** A clean, customizable web-based dashboard.
* **🚀 Quick Setup:** Get your control panel up and running in minutes.

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed on your system:
* [Node.js](https://nodejs.org/) (v16 or higher)
* npm (Node Package Manager)

---

## 📦 Installation & Setup

**1. Clone the repository**
```bash
git clone [https://github.com/reyaansh72/MineCtrl.git](https://github.com/reyaansh72/MineCtrl.git)
cd MineCtrl
2. Install dependencies (This will install the required express and cors packages)

Bash
npm install express cors
3. Start the server

Bash
node server.js
🌐 Usage
Once the server is running, open your favorite web browser and navigate to:

Plaintext
http://localhost:3000
📁 Project Structure
Plaintext
MineCtrl/
├── server.js       # Main application entry point
├── package.json    # Project metadata and dependencies
└── Users.json      # Local user database
🛠️ Development Mode (Optional)
If you are modifying the code and want the server to auto-restart on save, use nodemon:

Bash
# Install nodemon globally (if you haven't already)
npm install -g nodemon

# Run the server in development mode
npx nodemon server.js
📌 Important Notes
Port Configuration: The default server port is 3000. Make sure no other services are currently using this port.

Data Storage: User credentials and settings are stored locally in Users.json.

👨‍💻 Author
Reyaansh * GitHub: @reyaansh72

Made with ❤️ for the Minecraft community.
