import { invoke } from "@tauri-apps/api/core";

export const runSystemCommand = async (cmd: string): Promise<string> => {
  return await invoke<string>("run_system_command", { cmd });
};
