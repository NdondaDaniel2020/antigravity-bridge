import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { BridgePaths } from '../paths';
import { ChatSession, UniversalTurn } from '../types';

export class IdeStorage {
  /**
   * List all chats known to the IDE, combining agent-host.db and ~/.gemini/antigravity-ide/brain/
   */
  public static listSessions(workspaceFilter?: string): ChatSession[] {
    const sessionsMap = new Map<string, ChatSession>();

    // 1. Scan SQLite agent-host.db
    const dbPath = BridgePaths.getIdeAgentHostDbPath();
    if (fs.existsSync(dbPath)) {
      try {
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const rows = db.prepare(`
          SELECT 
            c.chat_uri, 
            c.owner_session_uri, 
            c.working_directories, 
            c.metadata, 
            s.start_time, 
            s.modified_time, 
            s.provider
          FROM chats_v2 c
          LEFT JOIN sessions_v2 s ON c.owner_session_uri = s.session_uri
        `).all() as any[];

        for (const row of rows) {
          const idMatch = (row.chat_uri || '').match(/([a-f0-9\-]{36})/i);
          const id = idMatch ? idMatch[1] : row.chat_uri;
          if (!id) continue;

          let meta: any = {};
          try {
            meta = JSON.parse(row.metadata || '{}');
          } catch {
            // ignore
          }

          const workspacePath = row.working_directories || '';
          if (workspaceFilter && workspacePath && !workspacePath.includes(workspaceFilter)) {
            continue;
          }

          sessionsMap.set(id, {
            id,
            title: meta.title || `Chat ${id.slice(0, 8)}`,
            createdAt: row.start_time || Date.now(),
            updatedAt: row.modified_time || Date.now(),
            workspacePath,
            provider: row.provider || 'gemini-agent',
            model: meta.model || 'gemini-3.8-flash',
            source: 'ide'
          });
        }
      } catch (err) {
        console.warn('IdeStorage: Could not query agent-host.db:', err);
      }
    }

    // 2. Scan brain directory (~/.gemini/antigravity-ide/brain/)
    const brainDir = BridgePaths.getIdeBrainDir();
    if (fs.existsSync(brainDir)) {
      try {
        const entries = fs.readdirSync(brainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const id = entry.name;
          const uuidRegex = /^[a-f0-9\-]{36}$/i;
          if (!uuidRegex.test(id)) continue;

          if (!sessionsMap.has(id)) {
            const transcriptPath = path.join(brainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
            let title = `Session ${id.slice(0, 8)}`;
            let createdAt = Date.now();
            let updatedAt = Date.now();

            if (fs.existsSync(transcriptPath)) {
              try {
                const stat = fs.statSync(transcriptPath);
                createdAt = stat.birthtimeMs || stat.ctimeMs;
                updatedAt = stat.mtimeMs;

                const firstLines = fs.readFileSync(transcriptPath, 'utf8').split('\n').slice(0, 10);
                for (const line of firstLines) {
                  if (!line.trim()) continue;
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'USER_INPUT' && parsed.content) {
                      const clean = parsed.content.replace(/<[^>]*>/g, '').trim();
                      if (clean) {
                        title = clean.slice(0, 60);
                        break;
                      }
                    }
                  } catch {
                    // skip malformed line
                  }
                }
              } catch {
                // ignore
              }
            }

            sessionsMap.set(id, {
              id,
              title,
              createdAt,
              updatedAt,
              workspacePath: workspaceFilter || '',
              source: 'ide'
            });
          }
        }
      } catch (err) {
        console.warn('IdeStorage: Could not read brain directory:', err);
      }
    }

    return Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Injects/Imports a session into Antigravity IDE so it appears in the chat list.
   */
  public static injectSession(session: ChatSession, turns?: UniversalTurn[]): boolean {
    const id = session.id;

    // 1. Ensure the individual session.db exists in agentSessionData
    const sessionDir = path.join(BridgePaths.getIdeAgentSessionDataDir(), id);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const sessionDbPath = path.join(sessionDir, 'session.db');
    try {
      const sessionDb = new DatabaseSync(sessionDbPath);
      sessionDb.exec(`
        CREATE TABLE IF NOT EXISTS session_metadata (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, event_id TEXT, checkpoint_ref TEXT);
        CREATE TABLE IF NOT EXISTS file_edits (file_path TEXT, timestamp INTEGER);
      `);

      const insertMeta = sessionDb.prepare('INSERT OR REPLACE INTO session_metadata (key, value) VALUES (?, ?)');
      insertMeta.run('peerChatBacking', `chat://${id}`);
      insertMeta.run('title', session.title);
      insertMeta.run('workspacePath', session.workspacePath);

      if (turns && turns.length > 0) {
        const insertTurn = sessionDb.prepare('INSERT OR REPLACE INTO turns (id, event_id, checkpoint_ref) VALUES (?, ?, ?)');
        for (const t of turns) {
          insertTurn.run(t.id, t.turnId || t.id, '');
        }
      }
    } catch (err) {
      console.error(`IdeStorage: Failed to write ${sessionDbPath}:`, err);
    }

    // 2. Register into agent-host.db
    const hostDbPath = BridgePaths.getIdeAgentHostDbPath();
    if (fs.existsSync(path.dirname(hostDbPath))) {
      try {
        const hostDb = new DatabaseSync(hostDbPath);
        hostDb.exec(`
          CREATE TABLE IF NOT EXISTS sessions_v2 (
            session_uri TEXT PRIMARY KEY,
            provider TEXT,
            start_time INTEGER,
            external INTEGER,
            registration_source TEXT,
            session_generation TEXT,
            source_revision INTEGER,
            payload_version INTEGER,
            payload_hash TEXT,
            verified INTEGER,
            payload TEXT,
            is_chat_backing INTEGER,
            modified_time INTEGER
          );
          CREATE TABLE IF NOT EXISTS chats_v2 (
            chat_uri TEXT PRIMARY KEY,
            owner_session_uri TEXT,
            chat_order INTEGER,
            storage_resource TEXT,
            parent_chat TEXT,
            provider_data TEXT,
            origin TEXT,
            is_read INTEGER,
            archived INTEGER,
            inherited_turn_id TEXT,
            working_directories TEXT,
            metadata TEXT,
            metadata_hash TEXT,
            ownership_revision INTEGER,
            metadata_revision INTEGER,
            tombstoned INTEGER
          );
          CREATE TABLE IF NOT EXISTS session_chats (
            session_uri TEXT,
            chat_uri TEXT,
            chat_order INTEGER,
            provider_data TEXT,
            origin TEXT,
            inherited_turn_id TEXT,
            archived INTEGER,
            is_read INTEGER,
            PRIMARY KEY (session_uri, chat_uri)
          );
        `);

        const sessionUri = `agent-session://${id}`;
        const chatUri = `chat://${id}`;
        const now = Date.now();

        const insertSession = hostDb.prepare(`
          INSERT OR REPLACE INTO sessions_v2 (
            session_uri, provider, start_time, external, registration_source,
            payload_version, verified, is_chat_backing, modified_time
          ) VALUES (?, ?, ?, 0, 'bridge', 1, 1, 1, ?)
        `);
        insertSession.run(sessionUri, session.provider || 'gemini-agent', session.createdAt || now, now);

        const metadata = JSON.stringify({
          title: session.title,
          model: session.model || 'gemini-3.8-flash',
          importedAt: now
        });

        const insertChat = hostDb.prepare(`
          INSERT OR REPLACE INTO chats_v2 (
            chat_uri, owner_session_uri, chat_order, working_directories,
            metadata, is_read, archived, tombstoned
          ) VALUES (?, ?, 0, ?, ?, 1, 0, 0)
        `);
        insertChat.run(chatUri, sessionUri, session.workspacePath || '', metadata);

        const insertSessionChat = hostDb.prepare(`
          INSERT OR REPLACE INTO session_chats (
            session_uri, chat_uri, chat_order, archived, is_read
          ) VALUES (?, ?, 0, 0, 1)
        `);
        insertSessionChat.run(sessionUri, chatUri);
      } catch (err) {
        console.error('IdeStorage: Failed to update agent-host.db:', err);
      }
    }

    // 3. Update state.vscdb index if accessible
    const stateDbPath = BridgePaths.getIdeStateVscDbPath();
    if (fs.existsSync(stateDbPath)) {
      try {
        const stateDb = new DatabaseSync(stateDbPath);
        const row = stateDb.prepare("SELECT value FROM ItemTable WHERE key = 'chat.ChatSessionStore.index'").get() as any;
        let indexList: any[] = [];
        if (row && row.value) {
          try {
            indexList = JSON.parse(row.value);
          } catch {
            indexList = [];
          }
        }
        const exists = indexList.some((item: any) => item.sessionId === id || item.id === id);
        if (!exists) {
          indexList.unshift({
            sessionId: id,
            id: id,
            title: session.title,
            timestamp: Date.now()
          });
          const update = stateDb.prepare("INSERT OR REPLACE INTO ItemTable (key, value) VALUES ('chat.ChatSessionStore.index', ?)");
          update.run(JSON.stringify(indexList));
        }
      } catch (err) {
        // state.vscdb is an optional fast-index, continue gracefully
      }
    }

    return true;
  }
}
