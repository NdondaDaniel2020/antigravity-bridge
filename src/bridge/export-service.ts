import * as path from 'path';
import * as fs from 'fs';
import { BridgePaths } from '../paths';
import { AppStorage } from '../storage/app-storage';
import { CliStorage } from '../storage/cli-storage';
import { ChatSession, BridgeOperationResult } from '../types';

export class ExportService {
  /**
   * Send a chat session from IDE to Antigravity 2.0
   */
  public static async sendToAntigravity2(session: ChatSession): Promise<BridgeOperationResult> {
    try {
      const sourceBrain = path.join(BridgePaths.getIdeBrainDir(), session.id);
      const success = AppStorage.saveSession(session, fs.existsSync(sourceBrain) ? sourceBrain : undefined);

      if (success) {
        return {
          success: true,
          message: `Chat "${session.title}" enviado com sucesso para o Antigravity 2.0!`,
          sessionId: session.id,
          target: 'antigravity2'
        };
      }
      return {
        success: false,
        message: `Falha ao salvar sessão no storage do Antigravity 2.0.`,
        sessionId: session.id
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao enviar para Antigravity 2.0: ${err?.message || err}`,
        sessionId: session.id
      };
    }
  }

  /**
   * Send a chat session from IDE to agy CLI
   */
  public static async sendToCli(session: ChatSession): Promise<BridgeOperationResult> {
    try {
      const sourceBrain = path.join(BridgePaths.getIdeBrainDir(), session.id);
      const success = CliStorage.saveSession(session, fs.existsSync(sourceBrain) ? sourceBrain : undefined);

      if (success) {
        return {
          success: true,
          message: `Chat "${session.title}" enviado com sucesso para o agy CLI!`,
          sessionId: session.id,
          target: 'cli'
        };
      }
      return {
        success: false,
        message: `Falha ao salvar sessão no catálogo do CLI.`,
        sessionId: session.id
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao enviar para agy CLI: ${err?.message || err}`,
        sessionId: session.id
      };
    }
  }
}
