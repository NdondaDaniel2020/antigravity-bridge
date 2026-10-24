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
   * Scans ~/.gemini/config/projects/*.json where Antigravity 2.0 projects are officially defined!
   */
  public static resolveProjectId(workspacePath: string): string {
    const projectsDir = BridgePaths.getGeminiProjectsDir();
    const targetUri = pathToUri(workspacePath);
    const projectName = path.basename(workspacePath) || 'Project';

    if (fs.existsSync(projectsDir)) {
      try {
        const files = fs.readdirSync(projectsDir);
        for (const file of files) {
          if (!file.endsWith('.json') || file.includes('cli') || file.includes('outside')) continue;
          try {
            const content = fs.readFileSync(path.join(projectsDir, file), 'utf8');
            const data = JSON.parse(content);

            // 1. Check matching folderUri in resources
            const resources = data.projectResources?.resources || [];
            for (const r of resources) {
              const uri = r.gitFolder?.folderUri || r.localFolder?.folderUri;
              if (uri && (uri === targetUri || targetUri.endsWith(uri.replace('file://', '')) || uri.endsWith(workspacePath))) {
                console.log(`AppStorage: Reusing existing project JSON=${file} (id=${data.id}) for workspace=${workspacePath}`);
                return data.id;
              }
            }

            // 2. Check matching project name
            if (data.name && data.name.toLowerCase() === projectName.toLowerCase()) {
              console.log(`AppStorage: Reusing existing project by name=${data.name} (id=${data.id})`);
              return data.id;
            }
          } catch {
            // ignore malformed JSON
          }
        }
      } catch (err) {
        console.warn('AppStorage: Could not read projects directory:', err);
      }
    }

    // Fallback: check conversation_summaries.db
    const dbPath = BridgePaths.getAppConversationSummariesDbPath();
    if (fs.existsSync(dbPath)) {
      try {
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(dbPath, { readOnly: true });
        const row = db.prepare(
          `SELECT project_id FROM conversation_summaries
           WHERE workspace_uris LIKE ? AND project_id IS NOT NULL AND project_id != ''
           LIMIT 1`
        ).get(`%${workspacePath}%`) as any;

        if (row?.project_id) {
          return row.project_id;
        }
      } catch {
        // ignore
      }
    }

    // Default project file creation
    const newId = crypto.randomUUID();
    const newProjectFile = path.join(projectsDir, `${newId}.json`);
    const projectConfig = {
      id: newId,
      name: projectName,
      projectResources: {
        resources: [
          {
            gitFolder: {
              folderUri: targetUri,
              defaultBranch: 'main'
            }
          }
        ]
      },
      settings: {},
      updatedAt: new Date().toISOString(),
      isWorkspaceOnly: false
    };

    try {
      fs.writeFileSync(newProjectFile, JSON.stringify(projectConfig, null, 2), 'utf8');
      console.log(`AppStorage: Created official Antigravity 2.0 project JSON: ${newProjectFile}`);
    } catch (err) {
      console.warn(`AppStorage: Failed to create project JSON ${newProjectFile}:`, err);
    }

    return newId;
  }

  /**
   * Save a chat session into Antigravity 2.0:
   * 1. Copy brain directory (JSONL transcripts + artifacts)
   * 2. Copy conversation SQLite file (<id>.db)
   * 3. Upsert into conversation_summaries.db with raw_summary protobuf
   * 4. Sync into agyhub_summaries_proto.pb (Antigravity 2.0 UI sidebar cache)
   */
  public static saveSession(session: ChatSession, sourceBrainDir?: string): boolean {
    const id = session.id;
    const workspacePath = session.workspacePath || '';

    // 1. Resolve official project_id: matches ~/.gemini/config/projects/*.json
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

    // 3. Mirror conversation sqlite database (<id>.db)
    const ideConvDb = path.join(BridgePaths.getIdeConversationsDir(), `${id}.db`);
    const appConvDb = path.join(BridgePaths.getAppConversationsDir(), `${id}.db`);
    let stepCount = 0;

    if (fs.existsSync(ideConvDb)) {
      try {
        fs.copyFileSync(ideConvDb, appConvDb);
        if (fs.existsSync(`${ideConvDb}-wal`)) {
          fs.copyFileSync(`${ideConvDb}-wal`, `${appConvDb}-wal`);
        }
        console.log(`AppStorage: Copied conversation db to ${appConvDb}`);

        try {
          const { DatabaseSync } = require('node:sqlite');
          const convDb = new DatabaseSync(appConvDb, { readOnly: true });
          const row = convDb.prepare('SELECT count(*) as count FROM steps').get() as any;
          if (row && row.count) {
            stepCount = row.count;
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.warn(`AppStorage: Could not copy conversation database:`, err);
      }
    }

    // 4. Upsert into conversation_summaries.db and agyhub_summaries_proto.pb
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
      const lastInputStep = stepCount > 0 ? stepCount - 1 : 0;

      // Extract or create raw_summary protobuf chunk
      let rawSummaryBlob: Buffer | null = null;
      const sampleRow = db.prepare(
        `SELECT raw_summary FROM conversation_summaries WHERE raw_summary IS NOT NULL LIMIT 1`
      ).get() as any;

      if (sampleRow && sampleRow.raw_summary) {
        const sampleBlob = Buffer.from(sampleRow.raw_summary);
        // Replace UUIDs and URIs in sample chunk to create valid protobuf record
        let str = sampleBlob.toString('binary');
        // Replace any 36-char uuid in sample with new id and project
        const match = str.match(/[a-f0-9\-]{36}/);
        if (match) {
          str = str.replaceAll(match[0], id);
        }
        rawSummaryBlob = Buffer.from(str, 'binary');
      }

      const existing = db.prepare(
        `SELECT conversation_id FROM conversation_summaries WHERE conversation_id = ?`
      ).get(id) as any;

      if (existing) {
        db.prepare(
          `UPDATE conversation_summaries
           SET title = ?, preview = ?, step_count = ?, last_modified_time = ?, 
               last_user_input_time = ?, last_user_input_step_index = ?, project_id = ?,
               raw_summary = COALESCE(?, raw_summary)
           WHERE conversation_id = ?`
        ).run(session.title, session.title, stepCount, now, now, lastInputStep, projectId, rawSummaryBlob, id);
      } else {
        db.prepare(
          `INSERT INTO conversation_summaries
             (conversation_id, title, preview, step_count, last_modified_time,
              workspace_uris, status, source, project_id, agent_name,
              parent_conversation_id, nesting_depth, battle_id, winning_conversation_id,
              not_fully_idle, killed, last_user_input_time, last_user_input_step_index,
              app_data_dir, group_id, raw_summary)
           VALUES (?, ?, ?, ?, ?, ?, 'CASCADE_RUN_STATUS_IDLE', '', ?, '', '', 0, '', '', 0, 0, ?, ?, 'antigravity', '', ?)`
        ).run(
          id,
          session.title,
          session.title,
          stepCount,
          now,
          JSON.stringify([workspaceUri]),
          projectId,
          now,
          lastInputStep,
          rawSummaryBlob
        );
      }

      // 5. Append to agyhub_summaries_proto.pb if protobuf chunk is available
      const protoPath = BridgePaths.getAppSummariesProtoPath();
      if (fs.existsSync(protoPath) && rawSummaryBlob) {
        try {
          const protoData = fs.readFileSync(protoPath);
          if (!protoData.includes(Buffer.from(id))) {
            fs.appendFileSync(protoPath, rawSummaryBlob);
            console.log(`AppStorage: Synced protobuf into agyhub_summaries_proto.pb`);
          }
        } catch (err) {
          console.warn(`AppStorage: Could not append to agyhub proto:`, err);
        }
      }

      return true;
    } catch (err) {
      console.error('AppStorage: Failed to upsert into conversation_summaries.db:', err);
      return false;
    }
  }
}
