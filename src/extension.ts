import * as vscode from 'vscode';
import { IdeStorage } from './storage/ide-storage';
import { AppStorage } from './storage/app-storage';
import { CliStorage } from './storage/cli-storage';
import { ExportService } from './bridge/export-service';
import { ImportService } from './bridge/import-service';
import { LauncherService } from './bridge/launcher-service';
import { ChatPicker } from './ui/chat-picker';

export function activate(context: vscode.ExtensionContext) {
  console.log('Antigravity Bridge extension is now active!');

  const getCurrentWorkspace = (): string => {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  };

  // 1. Antigravity Bridge: Send Chat to Antigravity 2.0
  const cmdSendToAntigravity2 = vscode.commands.registerCommand(
    'antigravityBridge.sendToAntigravity2',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = IdeStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat do Antigravity IDE encontrado para enviar.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat do IDE para enviar ao Antigravity 2.0'
      );
      if (!session) return;

      const result = await ExportService.sendToAntigravity2(session);
      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  // 2. Antigravity Bridge: Send Chat to CLI
  const cmdSendToCli = vscode.commands.registerCommand(
    'antigravityBridge.sendToCli',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = IdeStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat do Antigravity IDE encontrado para enviar.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat do IDE para enviar ao agy CLI'
      );
      if (!session) return;

      const result = await ExportService.sendToCli(session);
      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  // 3. Antigravity Bridge: Import Chat from Antigravity 2.0
  const cmdImportFromAntigravity2 = vscode.commands.registerCommand(
    'antigravityBridge.importFromAntigravity2',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = AppStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat encontrado no Antigravity 2.0 para importar.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat do Antigravity 2.0 para importar para o IDE'
      );
      if (!session) return;

      // Update workspace path to current if missing
      if (!session.workspacePath && workspace) {
        session.workspacePath = workspace;
      }

      const result = await ImportService.importFromAntigravity2(session);
      if (result.success) {
        const action = await vscode.window.showInformationMessage(
          result.message,
          'Recarregar Janela'
        );
        if (action === 'Recarregar Janela') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  // 4. Antigravity Bridge: Import Chat from CLI
  const cmdImportFromCli = vscode.commands.registerCommand(
    'antigravityBridge.importFromCli',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = CliStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat encontrado no agy CLI para importar.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat do agy CLI para importar para o IDE'
      );
      if (!session) return;

      if (!session.workspacePath && workspace) {
        session.workspacePath = workspace;
      }

      const result = await ImportService.importFromCli(session);
      if (result.success) {
        const action = await vscode.window.showInformationMessage(
          result.message,
          'Recarregar Janela'
        );
        if (action === 'Recarregar Janela') {
          vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  // 5. Antigravity Bridge: Open in Antigravity 2.0
  const cmdOpenInAntigravity2 = vscode.commands.registerCommand(
    'antigravityBridge.openInAntigravity2',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = IdeStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat do Antigravity IDE encontrado para abrir.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat para abrir no Antigravity 2.0'
      );
      if (!session) return;

      const result = await LauncherService.openInAntigravity2(session);
      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  // 6. Antigravity Bridge: Open in agy Terminal
  const cmdOpenInAgyTerminal = vscode.commands.registerCommand(
    'antigravityBridge.openInAgyTerminal',
    async () => {
      const workspace = getCurrentWorkspace();
      const sessions = IdeStorage.listSessions(workspace);

      if (sessions.length === 0) {
        vscode.window.showWarningMessage('Nenhum chat do Antigravity IDE encontrado para abrir no terminal.');
        return;
      }

      const session = await ChatPicker.selectSession(
        sessions,
        'Selecione o chat para abrir no terminal agy'
      );
      if (!session) return;

      const result = await LauncherService.openInAgyTerminal(session);
      if (result.success) {
        vscode.window.showInformationMessage(result.message);
      } else {
        vscode.window.showErrorMessage(result.message);
      }
    }
  );

  context.subscriptions.push(
    cmdSendToAntigravity2,
    cmdSendToCli,
    cmdImportFromAntigravity2,
    cmdImportFromCli,
    cmdOpenInAntigravity2,
    cmdOpenInAgyTerminal
  );
}

export function deactivate() {}
