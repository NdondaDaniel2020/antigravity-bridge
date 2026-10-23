import * as vscode from 'vscode';
import { ChatSession } from '../types';

export class ChatPicker {
  /**
   * Prompts the user to select a chat from a given list
   */
  public static async selectSession(
    sessions: ChatSession[],
    placeholder: string
  ): Promise<ChatSession | undefined> {
    if (sessions.length === 0) {
      vscode.window.showInformationMessage('Nenhum chat encontrado para a operação.');
      return undefined;
    }

    const items: (vscode.QuickPickItem & { session: ChatSession })[] = sessions.map((s) => {
      const dateStr = new Date(s.updatedAt || s.createdAt).toLocaleString();
      return {
        label: `$(comment-discussion) ${s.title}`,
        description: `[${s.source.toUpperCase()}] ${dateStr}`,
        detail: s.workspacePath ? `Projeto: ${s.workspacePath}` : `ID: ${s.id}`,
        session: s
      };
    });

    const chosen = await vscode.window.showQuickPick(items, {
      placeHolder: placeholder,
      matchOnDescription: true,
      matchOnDetail: true
    });

    return chosen ? chosen.session : undefined;
  }
}
