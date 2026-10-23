<div align="center">

<img src="https://raw.githubusercontent.com/NdondaDaniel2020/antigravity-bridge/main/assets/icon.png" width="128" height="128" alt="Antigravity Platform Bridge Logo" />

# Antigravity Platform Bridge: IDE ↔ CLI ↔ 2.0

**Sincronize e transfira conversas de IA entre os três ambientes do ecossistema Google Antigravity com 1 clique.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey.svg)](#)

</div>

---

## ⚡ Visão Geral

Trabalhas entre terminais, o desktop app e o editor ao mesmo tempo?

**Antigravity Platform Bridge** é a ponte oficial entre os três ambientes do ecossistema Antigravity:

- **Antigravity IDE** (VS Code Edition)
- **Antigravity 2.0** (Desktop Electron App)
- **`agy` CLI** (Command Line Interface)

Sincroniza histórico de chats, transcrições JSONL e artefatos de forma atómica, sem perder contexto entre plataformas.

---

## 🚀 Comandos Disponíveis

Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P` no macOS) e escreva:

| Comando | Descrição |
|---------|-----------|
| `Antigravity: Send Chat to Antigravity 2.0` | Exporta o chat atual do IDE para o Antigravity 2.0 |
| `Antigravity: Send Chat to CLI` | Exporta o chat para `~/.gemini/` para retomar via `agy` |
| `Antigravity: Import Chat from Antigravity 2.0` | Importa conversas do desktop app para o IDE |
| `Antigravity: Import Chat from CLI` | Importa conversas criadas no terminal para o IDE |
| `Antigravity: Open in Antigravity 2.0` | Sincroniza e abre o chat no desktop app |
| `Antigravity: Open in agy Terminal` | Sincroniza e abre terminal com `agy --resume <session-id>` |

---

## 🛠️ Como funciona

- **Engine SQLite Nativa:** Usa o módulo `node:sqlite` do Node.js 22, operando atomicamente com `agent-host.db` e `session.db`.
- **Transcrições JSONL:** Espelha a pasta `brain/<conversation-id>/.system_generated/logs/` entre ambientes.
- **QuickPick Inteligente:** Filtra conversas por título, data e projeto para seleção rápida.

---

## 📦 Instalação via .vsix

```bash
# Compilar
npm run build

# Empacotar
npx @vscode/vsce package --no-dependencies

# Instalar
code --install-extension antigravity-bridge-0.1.0.vsix
```

---

## 📄 Licença

MIT © [NdondaDaniel2020](https://github.com/NdondaDaniel2020)
