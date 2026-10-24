import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class BridgePaths {
  public static getHomeDir(): string {
    return os.homedir();
  }

  public static getGeminiDir(): string {
    return path.join(this.getHomeDir(), '.gemini');
  }

  // --- BRAIN DIRECTORIES (JSONL transcripts & artifacts) ---
  public static getIdeBrainDir(): string {
    const dir = path.join(this.getGeminiDir(), 'antigravity-ide', 'brain');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getAppBrainDir(): string {
    // Antigravity 2.0 app brain directory (~/.gemini/antigravity/brain)
    const dir = path.join(this.getGeminiDir(), 'antigravity', 'brain');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getCliBrainDir(): string {
    const dir = path.join(this.getGeminiDir(), 'brain');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // --- CONVERSATION SQLITE DIRECTORIES (<id>.db) ---
  public static getIdeConversationsDir(): string {
    const dir = path.join(this.getGeminiDir(), 'antigravity-ide', 'conversations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getAppConversationsDir(): string {
    const dir = path.join(this.getGeminiDir(), 'antigravity', 'conversations');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // --- PROJECTS JSON DIRECTORY (~/.gemini/config/projects/) ---
  public static getGeminiProjectsDir(): string {
    const dir = path.join(this.getGeminiDir(), 'config', 'projects');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  // --- IDE SQLITE PATHS ---
  public static getIdeAgentHostDbPath(): string {
    return path.join(this.getHomeDir(), '.config', 'Code', 'User', 'globalStorage', 'agent-host.db');
  }

  public static getIdeAgentSessionDataDir(): string {
    const dir = path.join(this.getHomeDir(), '.config', 'Code', 'agentSessionData');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  public static getIdeStateVscDbPath(): string {
    return path.join(this.getHomeDir(), '.config', 'Code', 'User', 'globalStorage', 'state.vscdb');
  }

  // --- ANTIGRAVITY 2.0 PATHS ---
  public static getAntigravityConfigDir(): string {
    return path.join(this.getHomeDir(), '.config', 'Antigravity');
  }

  public static getAppConversationSummariesDbPath(): string {
    return path.join(this.getGeminiDir(), 'antigravity', 'conversation_summaries.db');
  }

  public static getAppStorageJsonPath(): string {
    return path.join(this.getAntigravityConfigDir(), 'app_storage.json');
  }

  public static getAntigravityAppExecutable(): string {
    const possiblePaths = [
      '/opt/antigravity/antigravity',
      path.join(this.getHomeDir(), '.config', 'Antigravity', 'bin', 'agy-node'),
      '/usr/bin/antigravity',
      '/usr/local/bin/antigravity'
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return 'antigravity';
  }

  // --- CLI PATHS ---
  public static getCliSessionsJsonPath(): string {
    return path.join(this.getGeminiDir(), 'sessions.json');
  }
}
