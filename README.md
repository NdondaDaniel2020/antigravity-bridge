<div align="center">

<img src="https://raw.githubusercontent.com/NdondaDaniel2020/antigravity-bridge/main/icon.png" width="128" height="128" alt="Antigravity Bridge Logo" />

# Antigravity Bridge

**Seamlessly bridge, synchronize, and migrate AI chat conversations between Antigravity IDE, agy CLI, and Antigravity 2.0.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-available-purple.svg)](https://open-vsx.org/extension/NdondaDaniel2020/antigravity-bridge)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg)](#)

</div>

---

## ⚡ Overview

The Google Antigravity ecosystem empowers developers across three distinct environments:

1. **Antigravity IDE:** The flagship editor interface (VS Code edition) with full workspace context and agent panels.
2. **`agy` (CLI):** The blazing-fast, headless command-line interface for terminal-centric workflows and agent scripting.
3. **Antigravity 2.0:** The standalone Electron desktop application.

By default, these three environments operate in **isolated storage silos**. A trajectory or reasoning session started in your terminal (`agy`) cannot be viewed or continued in the IDE sidebar, and chats created in the desktop app cannot easily be resumed from a terminal.

**Antigravity Bridge** unites the entire suite. With one click from your Command Palette, it enables true **bidirectional session migration, trajectory replication, and immediate launcher continuity** across all three platforms.

---

## Features

- **Bidirectional Migration:** Send active or archived conversations from Antigravity IDE directly to `agy` CLI or Antigravity 2.0, or import existing sessions from the terminal and desktop into the IDE.
- **Direct Launchers:** Open and resume any session in an integrated VS Code terminal running `agy --resume <id>` or launch the Antigravity 2.0 desktop app with the active chat pre-loaded.
- **Zero-Dependency Native SQLite:** Built on Node.js 22 native `node:sqlite` (`DatabaseSync`) for instantaneous, crash-resilient database transactions without heavy native C++ compilation modules.
- **Full Trajectory & Metadata Preservation:** Keeps conversation UUIDs, titles, timestamps, turns, and workspace directories intact during every transfer.
- **Interactive QuickPick Selector:** Intuitively search, preview, and select sessions with origin badges, project paths, and timestamps directly from the Command Palette.
- **100% Local & Private:** All migrations occur strictly between local databases and JSON files on your machine. Zero network requests, zero telemetry.
- **Cross-Platform:** Full out-of-the-box support for **Linux**, **macOS**, and **Windows**.

---

## How to Use

1. Open **Antigravity IDE**.
2. Open the Command Palette:
   - **Linux / Windows:** `Ctrl + Shift + P` (or `F1`)
   - **macOS:** `Cmd + Shift + P`
3. Type `Antigravity Bridge` to view all available commands:

| Command | Identifier | Description |
| :--- | :--- | :--- |
| **`Antigravity Bridge: Send Chat to Antigravity 2.0`** | `antigravityBridge.sendToAntigravity2` | Exports the active or chosen IDE chat into Antigravity 2.0 catalog. |
| **`Antigravity Bridge: Send Chat to CLI`** | `antigravityBridge.sendToCli` | Exports chat to `~/.gemini/sessions.json` so you can run `agy --resume <id>`. |
| **`Antigravity Bridge: Import Chat from Antigravity 2.0`** | `antigravityBridge.importFromAntigravity2` | Imports conversations from Desktop 2.0 into the Antigravity IDE database. |
| **`Antigravity Bridge: Import Chat from CLI`** | `antigravityBridge.importFromCli` | Imports terminal sessions from `agy` CLI into the Antigravity IDE sidebar. |
| **`Antigravity Bridge: Open in Antigravity 2.0`** | `antigravityBridge.openInAntigravity2` | Synchronizes the active chat and launches the Antigravity 2.0 desktop app. |
| **`Antigravity Bridge: Open in agy Terminal`** | `antigravityBridge.openInAgyTerminal` | Synchronizes the chat and opens a VS Code terminal running `agy --resume`. |

---

## How It Works Behind the Scenes

```text
┌─────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│   agy (CLI)     │ <───> │   antigravity-bridge   │ <───> │ Antigravity 2.0 │
│ ~/.gemini/      │       │  (Extension / Engine)  │       │ Electron App    │
│ sessions.json   │       └───────────┬────────────┘       │ app_storage.json│
└─────────────────┘                   │                    └─────────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │    Antigravity IDE     │
                          │ agent-host.db (SQLite) │
                          │ session.db & state.vscdb│
                          └────────────────────────┘
```

1. **Antigravity IDE Persistence (`node:sqlite`):**
   - Queries and writes to `agent-host.db` across the `chats_v2`, `sessions_v2`, and `session_chats` relational tables.
   - Creates the individual per-chat SQLite store at `agentSessionData/<uuid>/session.db`.
   - Updates the IDE fast-index inside `state.vscdb` (`chat.ChatSessionStore.index`).
2. **`agy` CLI Persistence:**
   - Performs atomic file locking and updates on `~/.gemini/sessions.json`.
   - Replicates trajectory logs into `~/.gemini/brain/<uuid>/.system_generated/logs/transcript.jsonl`.
3. **Antigravity 2.0 Desktop Persistence:**
   - Synchronizes app catalog entries inside `~/.config/Antigravity/app_storage.json`.

---

## Privacy & Security

- **No External Network Calls:** The extension communicates exclusively with local files and databases on your filesystem.
- **Zero Data Collection:** Zero analytics, zero telemetry, and zero tracking.
- **Atomic Operations:** Database updates use transacted writes to ensure your existing chats are never corrupted.

---

## Frequently Asked Questions (FAQ)

<details>
<summary><b>Can I resume a chat in the terminal that was started in the IDE?</b></summary>

**Yes.** Run `Antigravity Bridge: Send Chat to CLI` (or `Antigravity Bridge: Open in agy Terminal`). The extension exports the session metadata to `~/.gemini/sessions.json` and copies the trajectory to `~/.gemini/brain/<id>`. You can immediately resume it with `agy --resume <session-id>`.
</details>

<details>
<summary><b>Does this extension require compiling native C++ binaries?</b></summary>

**No.** Unlike older extensions that rely on `better-sqlite3`, Antigravity Bridge uses Node.js 22 built-in `node:sqlite` (`DatabaseSync`). This guarantees zero build failures and maximum performance out of the box.
</details>

<details>
<summary><b>Does importing a chat overwrite existing chats with the same ID?</b></summary>

**No.** It performs an `INSERT OR REPLACE` on the specific session record, updating timestamps and turns without modifying any other conversations in your database.
</details>

---

## Packaging and Local Installation

```bash
# Build production bundle
npm run build

# Package as VSIX
npx @vscode/vsce package --no-dependencies

# Install into Antigravity IDE / VS Code
code --install-extension antigravity-bridge-0.1.0.vsix
```

---

## License & Source Code

- **License:** [MIT License](LICENSE)
- **Source Code:** [GitHub Repository](https://github.com/NdondaDaniel2020/antigravity-bridge)
- **Issues & Feedback:** [GitHub Issues](https://github.com/NdondaDaniel2020/antigravity-bridge/issues)
