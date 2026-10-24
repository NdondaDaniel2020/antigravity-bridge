import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BridgePaths } from '../paths';
import { ChatSession } from '../types';

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
    const dbPath = BridgePaths.getAppConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
      return [];
    }

    const sessions: ChatSession[] = [];

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });

      let rows: any[];
      if (workspaceFilter) {
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
   * - Otherwise -> generate a new UUID
   */
  public static resolveProjectId(workspacePath: string): string {
    const dbPath = BridgePaths.getAppConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
      return crypto.randomUUID();
    }

    try {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const row = db.prepare(
        `SELECT project_id FROM conversation_summaries
         WHERE workspace_uris LIKE ? AND project_id IS NOT NULL AND project_id != ''
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
   * 2. Copy conversation SQLite file (<id>.db) if exists
   * 3. Upsert into conversation_summaries.db with all required NOT NULL constraints
   */
  public static saveSession(session: ChatSession, sourceBrainDir?: string): boolean {
    const id = session.id;
    const workspacePath = session.workspacePath || '';

    // 1. Resolve project_id: reuse existing workspace if one exists
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

    // 3. Mirror conversation sqlite database (<id>.db, <id>.db-wal, etc.)
    const ideConvDb = path.join(BridgePaths.getIdeConversationsDir(), `${id}.db`);
    const appConvDb = path.join(BridgePaths.getAppConversationsDir(), `${id}.db`);
    if (fs.existsSync(ideConvDb)) {
      try {
        fs.copyFileSync(ideConvDb, appConvDb);
        // Copy wal if present
        if (fs.existsSync(`${ideConvDb}-wal`)) {
          fs.copyFileSync(`${ideConvDb}-wal`, `${appConvDb}-wal`);
        }
        console.log(`AppStorage: Copied conversation db to ${appConvDb}`);
      } catch (err) {
        console.warn(`AppStorage: Could not copy conversation database:`, err);
      }
    }

    // 4. Upsert into conversation_summaries.db
    const dbPath = BridgePaths.getAppConversationSummariesDbPath();
    if (!fs.existsSync(dbPath)) {
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
        // Chat already exists -> update title, last_modified_time, last_user_input_time, project_id
        db.prepare(
          `UPDATE conversation_summaries
           SET title = ?, preview = ?, last_modified_time = ?, last_user_input_time = ?, project_id = ?
           WHERE conversation_id = ?`
        ).run(session.title, session.title, now, now, projectId, id);
        console.log(`AppStorage: Updated existing chat ${id} in project ${projectId}`);
      } else {
        // New chat -> insert satisfying all NOT NULL constraints
        db.prepare(
          `INSERT INTO conversation_summaries
             (conversation_id, title, preview, step_count, last_modified_time,
              workspace_uris, status, source, project_id, agent_name,
              parent_conversation_id, nesting_depth, battle_id, winning_conversation_id,
              not_fully_idle, killed, last_user_input_time, last_user_input_step_index,
              app_data_dir, group_id)
           VALUES (?, ?, ?, 0, ?, ?, 'CASCADE_RUN_STATUS_IDLE', '', ?, '', '', 0, '', '', 0, 0, ?, 0, 'antigravity', '')`
        ).run(
          id,
          session.title,
          session.title,
          now,
          JSON.stringify([workspaceUri]),
          projectId,
          now
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
