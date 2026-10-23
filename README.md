# Antigravity Bridge 🌉

**Antigravity Bridge** é uma extensão projetada para sincronizar, transferir e retomar conversas e histórico de IA entre os três ambientes do ecossistema Google Antigravity:

- **Antigravity IDE** (VS Code Edition)
- **Antigravity 2.0** (Desktop Electron App)
- **`agy` CLI** (Command Line Interface)

---

## 🚀 Comandos Disponíveis

Pressione `Ctrl+Shift+P` (ou `Cmd+Shift+P` no macOS) para abrir a Command Palette e digite:

1. **`Antigravity Bridge: Send Chat to Antigravity 2.0`**
   - Exporta o chat atual do IDE para o diretório e catálogo do Antigravity 2.0, preservando turnos, transcrições e artefatos.

2. **`Antigravity Bridge: Send Chat to CLI`**
   - Exporta o chat atual para `~/.gemini/sessions.json` e `~/.gemini/brain/`, permitindo retomá-lo instantaneamente via terminal com o `agy`.

3. **`Antigravity Bridge: Import Chat from Antigravity 2.0`**
   - Abre uma lista das conversas existentes no Antigravity 2.0 para o projeto atual e a importa para o SQLite interno do IDE (`agent-host.db` e `session.db`).

4. **`Antigravity Bridge: Import Chat from CLI`**
   - Abre uma lista de conversas criadas no terminal e importa para o Antigravity IDE com associação ao projeto.

5. **`Antigravity Bridge: Open in Antigravity 2.0`**
   - Sincroniza o chat ativo e inicializa/foca automaticamente o aplicativo desktop do Antigravity 2.0 no projeto.

6. **`Antigravity Bridge: Open in agy Terminal`**
   - Sincroniza o chat ativo e abre um **Terminal Integrado do VS Code** já rodando `agy --resume <session-id>` para continuidade imediata.

---

## 🛠️ Como funciona por baixo do capô

- **Engine SQLite Nativa:** Utiliza o módulo nativo `node:sqlite` do Node.js 22, interagindo de forma atômica com `agent-host.db` (`chats_v2`, `sessions_v2`, `session_chats`) e gerando o banco de sessão `session.db` individual.
- **Transcrições JSONL Padronizadas:** Espelha e sincroniza as pastas `brain/<conversation-id>/.system_generated/logs/transcript.jsonl` entre os ambientes.
- **QuickPick Inteligente:** Filtra e exibe o título da conversa, data de atualização e caminho do projeto para seleção rápida.

---

## 📦 Como Empacotar e Instalar (.vsix)

```bash
# Compilar a extensão
npm run build

# Gerar o arquivo .vsix
npx @vscode/vsce package --no-dependencies

# Instalar no Antigravity IDE / VS Code
code --install-extension antigravity-bridge-0.1.0.vsix
```

---

## 📄 Licença
MIT © [NdondaDaniel2020](https://github.com/NdondaDaniel2020)
