export type Update = {
  version: string;
  date?: string;
  body?: string;
  downloadAndInstall: (onProgress?: (event: any) => void) => Promise<void>;
};

export async function check(): Promise<Update | null> {
  return null;
}
