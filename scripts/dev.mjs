import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * npm run dev - starts the API and the web client together, with prefixed logs.
 *
 * No dependencies needed (concurrently/npm-run-all would do the same thing).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  { name: "api", cwd: path.join(root, "backend"), args: ["run", "dev"], color: "\x1b[32m" },
  { name: "web", cwd: path.join(root, "website"), args: ["run", "dev"], color: "\x1b[36m" },
];

const RESET = "\x1b[0m";
const children = [];
let shuttingDown = false;

function prefix(name, color) {
  return (chunk) => {
    const lines = String(chunk).split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;
      process.stdout.write(`${color}[${name}]${RESET} ${line}\n`);
    }
  };
}

for (const target of targets) {
  const child = spawn("npm", target.args, {
    cwd: target.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });

  child.stdout.on("data", prefix(target.name, target.color));
  child.stderr.on("data", prefix(target.name, target.color));
  child.on("exit", (code) => {
    if (shuttingDown) return;
    console.log(`${target.color}[${target.name}]${RESET} exited with code ${code}`);
    shutdown(code ?? 0);
  });

  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 300).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Starting StreetMeet - API on :5000, web on :5173 (Ctrl+C stops both)\n");
