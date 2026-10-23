import * as fs from 'fs';
import * as path from 'path';
import { BridgePaths } from '../paths';
import { ChatSession } from '../types';

export class CliStorage {
  /**
   * List all chats registered or stored for the agy CLI (~/.gemini/sessions.json & ~/.gemini/brain/)
   */
  public static listSessions(workspaceFilter?: string): ChatSession[] {
    const sessionsMap = new Map<string, ChatSession>();

    // 1. Read ~/.gemini/sessions.json
    const sessionsJsonPath = BridgePaths.getCliSessionsJsonPath();
    if (fs.existsSync(sessionsJsonPath)) {
      try {
        const raw = fs.readFileSync(sessionsJsonPath, 'utf8');
        const data = JSON.parse(raw);
        const list = Array.isArray(data) ? data : (data.sessions || []);

        for (const item of list) {
          const id = item.id || item.sessionId || item.conversation_id;
          if (!id) continue;

          const workspacePath = item.cwd || item.workspacePath || '';
          if (workspaceFilter && workspacePath && !workspacePath.includes(workspaceFilter)) {
            continue;
          }

          sessionsMap.set(id, {
            id,
            title: item.title || `CLI Chat ${id.slice(0, 8)}`,
            createdAt: item.created_at || item.createdAt || Date.now(),
            updatedAt: item.updated_at || item.updatedAt || Date.now(),
            workspacePath,
            source: 'cli'
          });
        }
      } catch (err) {
        console.warn('CliStorage: Failed reading sessions.json:', err);
      }
    }

    // 2. Scan ~/.gemini/brain/ (excluding subfolders like antigravity-ide and antigravity-app)
    const cliBrainDir = BridgePaths.getCliBrainDir();
    if (fs.existsSync(cliBrainDir)) {
      try {
        const entries = fs.readdirSync(cliBrainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const name = entry.name;
          if (name === 'antigravity-ide' || name === 'antigravity-app') continue;

          const uuidRegex = /^[a-f0-9\-]{36}$/i;
          if (!uuidRegex.test(name)) continue;

          if (!sessionsMap.has(name)) {
            const transcriptPath = path.join(cliBrainDir, name, '.system_generated', 'logs', 'transcript.jsonl');
            let title = `CLI Session ${name.slice(0, 8)}`;
            let createdAt = Date.now();
            let updatedAt = Date.now();

            if (fs.existsSync(transcriptPath)) {
              try {
                const stat = fs.statSync(transcriptPath);
                createdAt = stat.birthtimeMs || stat.ctimeMs;
                updatedAt = stat.mtimeMs;

                const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').slice(0, 10);
                for (const line of lines) {
                  if (!line.trim()) continue;
                  const parsed = JSON.parse(line);
                  if (parsed.type === 'USER_INPUT' && parsed.content) {
                    title = parsed.content.replace(/<[^>]*>/g, '').trim().slice(0, 60);
                    break;
                  }
                }
              } catch {
                // ignore
              }
            }

            sessionsMap.set(name, {
              id: name,
              title,
              createdAt,
              updatedAt,
              workspacePath: workspaceFilter || '',
              source: 'cli'
            });
          }
        }
      } catch (err) {
        console.warn('CliStorage: Could not read CLI brain dir:', err);
      }
    }

    return Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Registers a session into agy's sessions.json and mirrors files into ~/.gemini/brain/<id>
   */
  public static saveSession(session: ChatSession, sourceBrainDir?: string): boolean {
    const id = session.id;

    // 1. Mirror brain directory to ~/.gemini/brain/<id>
    const targetBrainPath = path.join(BridgePaths.getCliBrainDir(), id);
    if (sourceBrainDir && fs.existsSync(sourceBrainDir) && sourceBrainDir !== targetBrainPath) {
      try {
        fs.cpSync(sourceBrainDir, targetBrainPath, { recursive: true });
      } catch (err) {
        console.warn(`CliStorage: Could not copy brain dir from ${sourceBrainDir}:`, err);
      }
    }

    // 2. Update ~/.gemini/sessions.json
    const sessionsJsonPath = BridgePaths.getCliSessionsJsonPath();
    let sessions: any[] = [];
    if (fs.existsSync(sessionsJsonPath)) {
      try {
        const raw = fs.readFileSync(sessionsJsonPath, 'utf8');
        const parsed = JSON.parse(raw);
        sessions = Array.isArray(parsed) ? parsed : (parsed.sessions || []);
      } catch {
        sessions = [];
      }
    }

    const existingIndex = sessions.findIndex((s) => (s.id || s.sessionId) === id);
    const sessionEntry = {
      id,
      title: session.title,
      cwd: session.workspacePath,
      updated_at: Date.now(),
      created_at: session.createdAt || Date.now(),
      model: session.model || 'gemini-3.8-flash'
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...sessions[existingIndex], ...sessionEntry };
    } else {
      sessions.unshift(sessionEntry);
    }

    try {
      fs.writeFileSync(sessionsJsonPath, JSON.stringify(sessions, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('CliStorage: Failed writing sessions.json:', err);
      return false;
    }
  }
}
