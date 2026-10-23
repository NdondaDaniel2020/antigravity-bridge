import * as fs from 'fs';
import * as path from 'path';
import { BridgePaths } from '../paths';
import { ChatSession } from '../types';

export class AppStorage {
  /**
   * List all chats known to Antigravity 2.0 Desktop app
   */
  public static listSessions(workspaceFilter?: string): ChatSession[] {
    const sessionsMap = new Map<string, ChatSession>();

    // 1. Scan Antigravity 2.0 brain directory (~/.gemini/antigravity-app/brain/)
    const appBrainDir = BridgePaths.getAppBrainDir();
    if (fs.existsSync(appBrainDir)) {
      try {
        const entries = fs.readdirSync(appBrainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const id = entry.name;
          const uuidRegex = /^[a-f0-9\-]{36}$/i;
          if (!uuidRegex.test(id)) continue;

          const transcriptPath = path.join(appBrainDir, id, '.system_generated', 'logs', 'transcript.jsonl');
          let title = `Antigravity 2.0 Chat ${id.slice(0, 8)}`;
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

          sessionsMap.set(id, {
            id,
            title,
            createdAt,
            updatedAt,
            workspacePath: workspaceFilter || '',
            source: 'antigravity2'
          });
        }
      } catch (err) {
        console.warn('AppStorage: Could not read app brain dir:', err);
      }
    }

    // 2. Read app_storage.json for metadata hints
    const appStoragePath = BridgePaths.getAppStorageJsonPath();
    if (fs.existsSync(appStoragePath)) {
      try {
        const raw = fs.readFileSync(appStoragePath, 'utf8');
        const data = JSON.parse(raw);
        if (data.recentSessions && Array.isArray(data.recentSessions)) {
          for (const s of data.recentSessions) {
            if (s.id && !sessionsMap.has(s.id)) {
              sessionsMap.set(s.id, {
                id: s.id,
                title: s.title || `Chat ${s.id.slice(0, 8)}`,
                createdAt: s.createdAt || Date.now(),
                updatedAt: s.updatedAt || Date.now(),
                workspacePath: s.workspacePath || workspaceFilter || '',
                source: 'antigravity2'
              });
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return Array.from(sessionsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Saves and mirrors a chat into Antigravity 2.0 storage
   */
  public static saveSession(session: ChatSession, sourceBrainDir?: string): boolean {
    const id = session.id;

    // 1. Mirror brain directory into ~/.gemini/antigravity-app/brain/<id>
    const targetBrainPath = path.join(BridgePaths.getAppBrainDir(), id);
    if (sourceBrainDir && fs.existsSync(sourceBrainDir) && sourceBrainDir !== targetBrainPath) {
      try {
        fs.cpSync(sourceBrainDir, targetBrainPath, { recursive: true });
      } catch (err) {
        console.warn(`AppStorage: Could not copy brain dir from ${sourceBrainDir}:`, err);
      }
    }

    // 2. Update app_storage.json with project/session information if accessible
    const appStoragePath = BridgePaths.getAppStorageJsonPath();
    if (fs.existsSync(appStoragePath)) {
      try {
        const raw = fs.readFileSync(appStoragePath, 'utf8');
        const data = JSON.parse(raw);
        if (!data.recentSessions) {
          data.recentSessions = [];
        }
        const existingIdx = data.recentSessions.findIndex((s: any) => s.id === id);
        const record = {
          id,
          title: session.title,
          workspacePath: session.workspacePath,
          updatedAt: Date.now()
        };
        if (existingIdx >= 0) {
          data.recentSessions[existingIdx] = record;
        } else {
          data.recentSessions.unshift(record);
        }
        fs.writeFileSync(appStoragePath, JSON.stringify(data, null, 2), 'utf8');
      } catch (err) {
        console.warn('AppStorage: Could not update app_storage.json:', err);
      }
    }

    return true;
  }
}
