import * as path from 'path';
import * as fs from 'fs';
import { BridgePaths } from '../paths';
import { IdeStorage } from '../storage/ide-storage';
import { ChatSession, BridgeOperationResult, UniversalTurn } from '../types';

export class ImportService {
  /**
   * Import a session from Antigravity 2.0 into Antigravity IDE
   */
  public static async importFromAntigravity2(session: ChatSession): Promise<BridgeOperationResult> {
    try {
      const sourceBrain = path.join(BridgePaths.getAppBrainDir(), session.id);
      const targetBrain = path.join(BridgePaths.getIdeBrainDir(), session.id);

      if (fs.existsSync(sourceBrain) && sourceBrain !== targetBrain) {
        fs.cpSync(sourceBrain, targetBrain, { recursive: true });
      }

      const turns = this.extractTurnsFromBrain(targetBrain);
      const success = IdeStorage.injectSession(session, turns);

      if (success) {
        return {
          success: true,
          message: `Chat "${session.title}" importado com sucesso para o Antigravity IDE!`,
          sessionId: session.id,
          target: 'ide'
        };
      }
      return {
        success: false,
        message: 'Falha ao registrar sessão no SQLite do IDE.',
        sessionId: session.id
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao importar do Antigravity 2.0: ${err?.message || err}`,
        sessionId: session.id
      };
    }
  }

  /**
   * Import a session from agy CLI into Antigravity IDE
   */
  public static async importFromCli(session: ChatSession): Promise<BridgeOperationResult> {
    try {
      const sourceBrain = path.join(BridgePaths.getCliBrainDir(), session.id);
      const targetBrain = path.join(BridgePaths.getIdeBrainDir(), session.id);

      if (fs.existsSync(sourceBrain) && sourceBrain !== targetBrain) {
        fs.cpSync(sourceBrain, targetBrain, { recursive: true });
      }

      const turns = this.extractTurnsFromBrain(targetBrain);
      const success = IdeStorage.injectSession(session, turns);

      if (success) {
        return {
          success: true,
          message: `Chat "${session.title}" importado com sucesso do CLI para o Antigravity IDE!`,
          sessionId: session.id,
          target: 'ide'
        };
      }
      return {
        success: false,
        message: 'Falha ao registrar sessão no SQLite do IDE.',
        sessionId: session.id
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao importar do CLI: ${err?.message || err}`,
        sessionId: session.id
      };
    }
  }

  private static extractTurnsFromBrain(brainDir: string): UniversalTurn[] {
    const turns: UniversalTurn[] = [];
    const transcriptPath = path.join(brainDir, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(transcriptPath)) return turns;

    try {
      const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          turns.push({
            id: `turn-${parsed.step_index || turns.length + 1}`,
            stepIndex: parsed.step_index || turns.length + 1,
            source: parsed.source || 'MODEL',
            type: parsed.type || 'PLANNER_RESPONSE',
            content: parsed.content || '',
            toolCalls: parsed.tool_calls
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }

    return turns;
  }
}
