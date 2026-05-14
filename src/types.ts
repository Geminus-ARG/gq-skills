export type GithubDirectoryItem = {
  type: "file" | "dir" | "symlink" | "submodule";
  name: string;
  path: string;
  download_url: string | null;
};

export type AddOptions = {
  folder: string;
  repo: string;
  ref: string;
  cwd: string;
  agentsDir: string;
  cloudeDir: string;
  dryRun: boolean;
  token?: string;
};

export type DownloadedFile = {
  sourcePath: string;
  relativePath: string;
  content: Uint8Array;
};

export type GithubFile = {
  sourcePath: string;
  relativePath: string;
  downloadUrl: string;
};

export type FileProgress = {
  index: number;
  total: number;
  relativePath: string;
};

export type ProgressReporter = {
  file(progress: FileProgress): void;
  done(): void;
};

export type LoginOptions = {
  clientId: string;
  scope: string;
  openBrowser: boolean;
};

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval?: number;
};

export type AccessTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};