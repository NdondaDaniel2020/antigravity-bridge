import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { BridgePaths } from '../paths';
import { ChatSession } from '../types';

/** Path to the Antigravity 2.0 conversation_summaries.db */
function getConversationSummariesDbPath(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
}

/** Convert a local path to a file:// URI (as used by workspace_uris) */
function pathToUri(workspacePath: string): string {
  if (workspacePath.startsWith('file://')) {
    return workspacePath;
  }
  return 'file://' + workspacePath;
}

export class AppStorage {
  /**
   * List all chats known to Antigravity 2.0
   * Reads from conversation_summaries.db
   */
  public static listSessions(workspaceFilter?: string): ChatSession[] {
    const dbPath = getConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
      return [];
    }

    const sessions: ChatSession[] = [];

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const workspaceUri = workspaceFilter ? pathToUri(workspaceFilter) : null;

      let rows: any[];
      if (workspaceUri) {
        rows = (db.prepare(
          `SELECT conversation_id, title, workspace_uris, project_id, last_modified_time
           FROM conversation_summaries
           WHERE workspace_uris LIKE ?
           ORDER BY last_modified_time DESC`
        ).all(`%${workspaceFilter}%`) as any[]);
      } else {
        rows = (db.prepare(
          `SELECT conversation_id, title, workspace_uris, project_id, last_modified_time
           FROM conversation_summaries
           ORDER BY last_modified_time DESC`
        ).all() as any[]);
      }

      for (const row of rows) {
        let workspacePath = '';
        try {
          const uris: string[] = JSON.parse(row.workspace_uris || '[]');
          workspacePath = uris[0]?.replace('file://', '') || '';
        } catch { /* ignore */ }

        sessions.push({
          id: row.conversation_id,
          title: row.title || `Chat ${row.conversation_id.slice(0, 8)}`,
          createdAt: Date.now(),
          updatedAt: new Date(row.last_modified_time).getTime() || Date.now(),
          workspacePath,
          source: 'antigravity2',
          projectId: row.project_id
        });
      }
    } catch (err) {
      console.warn('AppStorage: Could not read conversation_summaries.db:', err);
    }

    return sessions;
  }

  /**
   * Resolve the project_id for a given workspace path.
   * - If a project_id already exists for that workspace in conversation_summaries.db -> reuse it
   * - Otherwise -> generate a new UUID (workspace will be created implicitly on next app launch)
   */
  public static resolveProjectId(workspacePath: string): string {
    const dbPath = getConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
      return crypto.randomUUID();
    }

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const row = db.prepare(
        `SELECT project_id FROM conversation_summaries
         WHERE workspace_uris LIKE ? AND project_id IS NOT NULL
         LIMIT 1`
      ).get(`%${workspacePath}%`) as any;

      if (row?.project_id) {
        console.log(`AppStorage: Reusing existing project_id=${row.project_id} for workspace=${workspacePath}`);
        return row.project_id;
      }
    } catch (err) {
      console.warn('AppStorage: Could not resolve project_id:', err);
    }

    const newId = crypto.randomUUID();
    console.log(`AppStorage: No existing workspace found, creating new project_id=${newId}`);
    return newId;
  }

  /**
   * Save a chat session into Antigravity 2.0:
   * 1. Copy brain directory (JSONL transcripts + artifacts)
   * 2. Upsert into conversation_summaries.db with correct project_id
   *    (reuses existing workspace if one already exists for the same path)
   */
  public static saveSession(session: ChatSession, sourceBrainDir?: string): boolean {
    const id = session.id;
    const workspacePath = session.workspacePath || '';

    // 1. Resolve project_id: reuse existing workspace or create new one
    const projectId = AppStorage.resolveProjectId(workspacePath);

    // 2. Mirror brain directory into ~/.gemini/antigravity/brain/<id>/
    const targetBrainPath = path.join(BridgePaths.getAppBrainDir(), id);
    if (sourceBrainDir && fs.existsSync(sourceBrainDir) && sourceBrainDir !== targetBrainPath) {
      try {
        fs.cpSync(sourceBrainDir, targetBrainPath, { recursive: true });
        console.log(`AppStorage: Brain copied to ${targetBrainPath}`);
      } catch (err) {
        console.warn(`AppStorage: Could not copy brain dir:`, err);
      }
    }

    // 3. Upsert into conversation_summaries.db
    const dbPath = getConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
      // DB doesn't exist yet - can't write, but brain is already copied
      console.warn('AppStorage: conversation_summaries.db not found, skipping DB registration');
      return true;
    }

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath);
      const workspaceUri = pathToUri(workspacePath);
      const now = new Date().toISOString();

      const existing = db.prepare(
        `SELECT conversation_id FROM conversation_summaries WHERE conversation_id = ?`
      ).get(id) as any;

      if (existing) {
        // Chat already exists -> update title and last_modified_time only
        db.prepare(
          `UPDATE conversation_summaries
           SET title = ?, last_modified_time = ?, project_id = ?
           WHERE conversation_id = ?`
        ).run(session.title, now, projectId, id);
        console.log(`AppStorage: Updated existing chat ${id} in project ${projectId}`);
      } else {
        // New chat -> insert with workspace and project
        db.prepare(
          `INSERT INTO conversation_summaries
             (conversation_id, title, preview, step_count, last_modified_time,
              workspace_uris, status, source, project_id, app_data_dir)
           VALUES (?, ?, ?, 0, ?, ?, 'CASCADE_RUN_STATUS_IDLE', 1, ?, 'antigravity')`
        ).run(
          id,
          session.title,
          session.title,
          now,
          JSON.stringify([workspaceUri]),
          projectId
        );
        console.log(`AppStorage: Inserted new chat ${id} into project ${projectId} (workspace: ${workspacePath})`);
      }

      return true;
    } catch (err) {
      console.error('AppStorage: Failed to upsert into conversation_summaries.db:', err);
      return false;
    }
  }
}
