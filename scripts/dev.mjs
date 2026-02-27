import { spawn } from "node:child_process";

const commands = [
  { cmd: "npm", args: ["-w", "apps/server", "run", "dev"], name: "server" },
  { cmd: "npm", args: ["-w", "apps/client", "run", "dev"], name: "client" }
];

const procs = commands.map(({ cmd, args, name }) => {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: process.env
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });
  return { child, name };
});

const shutdown = (signal) => {
  for (const { child } of procs) {
    try {
      child.kill(signal);
    } catch {
      // ignore
    }
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

