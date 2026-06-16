import { spawn } from "node:child_process";

const commands = [
  ["server", ["run", "dev", "--workspace", "server"]],
  ["client", ["run", "dev", "--workspace", "client"]],
];

const children = commands.map(([name, args]) => {
  const child = spawn("npm", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`${name} exited with ${signal}`);
      return;
    }

    if (code !== 0) {
      console.log(`${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

