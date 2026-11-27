#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_DIR = fileURLToPath(new URL("..", import.meta.url));
const LOG_FILE = path.join(REPO_DIR, "tools/auto-sync.log");
const LOCK_FILE = path.join(REPO_DIR, ".git/forge-auto-sync.lock");
const TARGET_BRANCH = "master";
const DEBOUNCE_MS = 3000;
const RETRY_START_MS = 30_000;
const RETRY_MAX_MS = 5 * 60_000;
const POLL_MS = 30_000;
const HTTP_POST_BUFFER = 629_145_600;
const GIT = process.env.FORGE_GIT_BIN || "/opt/homebrew/bin/git";

const IGNORE_PATTERNS = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.next(\/|$)/,
  /(^|\/)\.vercel(\/|$)/,
  /(^|\/)out(\/|$)/,
  /\.db(?:-wal|-shm|-journal)?$/,
  /\.DS_Store$/,
  /tsconfig\.tsbuildinfo$/,
  /next-env\.d\.ts$/,
  /tools\/auto-sync(?:\.launchd)?\.log$/,
];

let debounceTimer = null;
let retryTimer = null;
let syncing = false;
let pending = false;
let retryDelay = RETRY_START_MS;
let watcher = null;

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Logging should never stop a sync attempt.
  }
  console.log(line);
}

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, "wx");
    fs.writeFileSync(fd, `${process.pid}\n`);
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  const existingPid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
  if (Number.isInteger(existingPid) && existingPid > 0) {
    try {
      process.kill(existingPid, 0);
      console.log(`Forge auto-sync is already running (PID ${existingPid}).`);
      return false;
    } catch (error) {
      if (error?.code !== "ESRCH") {
        console.log(`Forge auto-sync lock is held by PID ${existingPid}.`);
        return false;
      }
    }
  }

  fs.rmSync(LOCK_FILE, { force: true });
  const fd = fs.openSync(LOCK_FILE, "wx");
  fs.writeFileSync(fd, `${process.pid}\n`);
  fs.closeSync(fd);
  return true;
}

if (!acquireLock()) process.exit(0);

process.on("exit", () => {
  try {
    if (fs.readFileSync(LOCK_FILE, "utf8").trim() === String(process.pid)) {
      fs.rmSync(LOCK_FILE, { force: true });
    }
  } catch {
    // The lock may already have been removed during shutdown.
  }
});

function shouldIgnore(filename) {
  if (!filename) return false;
  const normalized = String(filename).replace(/\\/g, "/");
  if (path.posix.basename(normalized) === ".env.example") return false;
  if (/(^|\/)\.env(?:$|\.)/.test(normalized)) return true;
  return IGNORE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(GIT, ["-C", REPO_DIR, ...args], {
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ""}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      const error = new Error(`git ${args.join(" ")} exited ${code ?? signal}`);
      error.stderr = stderr;
      error.stdout = stdout;
      reject(error);
    });
  });
}

async function operationInProgress() {
  const markers = [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "REBASE_HEAD",
    "rebase-merge",
    "rebase-apply",
  ];
  for (const marker of markers) {
    const gitPath = await runGit(["rev-parse", "--git-path", marker]);
    if (fs.existsSync(path.resolve(REPO_DIR, gitPath))) return marker;
  }
  return null;
}

function describeChanges(status) {
  const files = status
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  if (files.length === 0) return "changes";
  if (files.length <= 2) return files.join(", ");
  return `${files.slice(0, 2).join(", ")} +${files.length - 2} more`;
}

function scheduleSync(delay = DEBOUNCE_MS) {
  if (syncing) {
    pending = true;
    return;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, delay);
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  log(`Will retry GitHub sync in ${Math.round(delay / 1000)} seconds.`);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduleSync(0);
  }, delay);
}

async function syncNow() {
  if (syncing) {
    pending = true;
    return;
  }
  syncing = true;
  pending = false;

  try {
    const operation = await operationInProgress();
    if (operation) throw new Error(`Git ${operation} is in progress; waiting before syncing.`);

    const status = await runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
    let summary = "existing local commits";
    if (status) {
      summary = describeChanges(status);
      await runGit(["add", "--all"]);
      const unresolved = await runGit(["diff", "--name-only", "--diff-filter=U"]);
      if (unresolved) throw new Error("Unresolved merge conflicts; waiting before syncing.");

      const staged = await runGit(["diff", "--cached", "--name-only", "-z"]);
      if (staged) {
        const commitMessage = `chore: auto-sync (${summary})`.slice(0, 180);
        await runGit(["commit", "--message", commitMessage]);
        log(`Committed local changes: ${summary}`);
      }
    }

    log(`Pushing current checkout to origin/${TARGET_BRANCH}…`);
    await runGit([
      "-c",
      `http.postBuffer=${HTTP_POST_BUFFER}`,
      "-c",
      "http.version=HTTP/1.1",
      "push",
      "--progress",
      "--porcelain",
      "origin",
      `HEAD:refs/heads/${TARGET_BRANCH}`,
    ]);

    retryDelay = RETRY_START_MS;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    log(`GitHub is up to date on origin/${TARGET_BRANCH}.`);
  } catch (error) {
    const details = [error?.message, error?.stderr, error?.stdout]
      .filter(Boolean)
      .join("\n")
      .slice(-6000);
    log(`GitHub sync failed:\n${details}`);
    scheduleRetry();
  } finally {
    syncing = false;
    if (pending) scheduleSync();
  }
}

log(`Starting Forge auto-sync for ${REPO_DIR}; target is origin/${TARGET_BRANCH}.`);
scheduleSync();

try {
  watcher = fs.watch(REPO_DIR, { recursive: true }, (_eventType, filename) => {
    if (shouldIgnore(filename)) return;
    scheduleSync();
  });
  watcher.on("error", (error) => log(`File watcher error: ${error.message}`));
} catch (error) {
  log(`Recursive file watch unavailable: ${error.message}; status polling remains active.`);
}

setInterval(() => {
  if (syncing) return;
  void runGit(["status", "--porcelain=v1", "--untracked-files=all"])
    .then((status) => {
      if (status) scheduleSync();
    })
    .catch((error) => log(`Git status polling failed: ${error.message}`));
}, POLL_MS);
