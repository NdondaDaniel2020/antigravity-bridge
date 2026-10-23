export type ChatEnvironment = 'ide' | 'antigravity2' | 'cli';

export interface ChatSession {
  id: string; // UUID (e.g. 8bfceaa9-eb20-473a-bfcb-dadf4f6d62c2)
  title: string;
  createdAt: number;
  updatedAt: number;
  workspacePath: string; // Absolute path to the workspace/project
  provider?: string;
  model?: string;
  turnCount?: number;
  source: ChatEnvironment;
  projectId?: string; // Antigravity 2.0 project/workspace UUID
  rawPayload?: string;
}

export interface UniversalTurn {
  id: string;
  stepIndex: number;
  source: 'USER_INPUT' | 'MODEL' | 'SYSTEM';
  type: string;
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  timestamp?: number;
}

export interface BridgeOperationResult {
  success: boolean;
  message: string;
  sessionId?: string;
  target?: ChatEnvironment;
}
