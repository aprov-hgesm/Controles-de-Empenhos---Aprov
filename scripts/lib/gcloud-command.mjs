import { spawnSync } from "node:child_process";

export function buildGcloudInvocation(args, {
  platform = process.platform,
  comspec = process.env.ComSpec,
} = {}) {
  const normalizedArgs = args.map((arg) => String(arg));

  if (platform === "win32") {
    return {
      command: comspec || "cmd.exe",
      args: ["/d", "/s", "/c", "gcloud.cmd", ...normalizedArgs],
    };
  }

  return {
    command: "gcloud",
    args: normalizedArgs,
  };
}

export function spawnGcloudSync(args, options = {}) {
  const invocation = buildGcloudInvocation(args);
  return spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    ...options,
  });
}

export function isMissingGcloud(result) {
  if (result.error?.code === "ENOENT") return true;

  const detail = `${result.stderr || ""}\n${result.stdout || ""}`;
  return /(?:gcloud(?:\.cmd)?).*(?:not recognized|not found|não é reconhecido)/iu.test(detail);
}
