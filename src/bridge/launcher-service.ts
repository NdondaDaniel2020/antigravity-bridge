import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { BridgePaths } from '../paths';
import { ExportService } from './export-service';
import { ChatSession, BridgeOperationResult } from '../types';

export class LauncherService {
  /**
   * Exports chat to Antigravity 2.0 and launches/focuses the desktop application
   */
  public static async openInAntigravity2(session: ChatSession): Promise<BridgeOperationResult> {
    // 1. Export first so the session data is ready
    const exportResult = await ExportService.sendToAntigravity2(session);
    if (!exportResult.success) {
      return exportResult;
    }

    // 2. Launch the desktop executable
    const executable = BridgePaths.getAntigravityAppExecutable();
    try {
      const child = spawn(executable, [session.workspacePath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      return {
        success: true,
        message: `Chat enviado e Antigravity 2.0 aberto para "${session.title}"!`,
        sessionId: session.id,
        target: 'antigravity2'
      };
    } catch (err: any) {
      // In case executable is not directly launchable via spawn, fallback to friendly message
      return {
        success: true,
        message: `Chat sincronizado! Abra o aplicativo Antigravity 2.0 e o projeto "${session.workspacePath}" para continuar.`,
        sessionId: session.id,
        target: 'antigravity2'
      };
    }
  }

  /**
   * Exports chat to CLI and opens an integrated terminal running agy --resume <id>
   */
  public static async openInAgyTerminal(session: ChatSession): Promise<BridgeOperationResult> {
    // 1. Export first so agy can resume the conversation
    const exportResult = await ExportService.sendToCli(session);
    if (!exportResult.success) {
      return exportResult;
    }

    // 2. Open an integrated terminal in VS Code
    const terminalTitle = `agy: ${session.title.slice(0, 25)}`;
    const term = vscode.window.createTerminal({
      name: terminalTitle,
      cwd: session.workspacePath || undefined
    });

    term.show(true);
    // Send resume command to agy CLI
    term.sendText(`agy --resume ${session.id}`);

    return {
      success: true,
      message: `Terminal iniciado com a sessão agy [${session.id.slice(0, 8)}]!`,
      sessionId: session.id,
      target: 'cli'
    };
  }
}
