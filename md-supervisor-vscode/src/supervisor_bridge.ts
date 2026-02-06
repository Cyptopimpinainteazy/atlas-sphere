import { spawn } from 'child_process';
import * as path from 'path';

export interface SupervisorResult {
  success: boolean;
  reason?: string;
  commit?: string;
  changes?: number;
  heatmaps?: any[];
  gates?: Record<string, boolean>;
  auto_rollback?: boolean;
}

export class SupervisorBridge {
  private pythonExecutable: string = 'python3';

  async runFullCycle(chatDir: string = 'chat_logs'): Promise<SupervisorResult> {
    return this.runPythonCommand([
      '-m', 'md_supervisor',
      '--ingest', chatDir,
      '--apply',
      '--atomic'
    ]);
  }

  async rollbackLastCommit(): Promise<SupervisorResult> {
    return this.runPythonCommand([
      '-m', 'md_supervisor',
      '--rollback'
    ]);
  }

  private runPythonCommand(args: string[]): Promise<SupervisorResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonExecutable, args, {
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        try {
          if (code === 0 && stdout) {
            const result = JSON.parse(stdout);
            resolve(result);
          } else {
            resolve({
              success: false,
              reason: stderr || 'Process exited with error',
            });
          }
        } catch (e) {
          resolve({
            success: false,
            reason: `Parse error: ${stderr || stdout}`,
          });
        }
      });

      proc.on('error', (err: Error) => {
        reject(err);
      });
    });
  }
}
