export function isCloudRunRuntime(env?: NodeJS.ProcessEnv): boolean;
export function getCloudRunAccessToken(options?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<string>;
export function resetCloudRunTokenCacheForTests(): void;
