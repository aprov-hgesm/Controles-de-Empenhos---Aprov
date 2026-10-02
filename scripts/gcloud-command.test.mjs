import assert from "node:assert/strict";
import test from "node:test";

import { buildGcloudInvocation } from "./lib/gcloud-command.mjs";

test("uses gcloud directly on non-Windows platforms", () => {
  assert.deepEqual(
    buildGcloudInvocation(["--version"], { platform: "linux" }),
    { command: "gcloud", args: ["--version"] },
  );
});

test("routes gcloud.cmd through cmd.exe on Windows", () => {
  assert.deepEqual(
    buildGcloudInvocation(["auth", "print-access-token"], {
      platform: "win32",
      comspec: "C:\\Windows\\System32\\cmd.exe",
    }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", "gcloud.cmd", "auth", "print-access-token"],
    },
  );
});

test("falls back to cmd.exe when ComSpec is unavailable", () => {
  assert.equal(
    buildGcloudInvocation(["--version"], {
      platform: "win32",
      comspec: "",
    }).command,
    "cmd.exe",
  );
});
