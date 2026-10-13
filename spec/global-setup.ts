import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { type AddressInfo, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
  }
}

// The spec checks a RUNNING app over HTTP. In CI that's the Docker image,
// started with a throwaway /data, and APP_URL points at it. Locally, with no
// APP_URL, this boots the BUILT server (the artefact the Dockerfile runs; `pnpm
// test` builds first) on a free port with a throwaway database, so the spec
// never reads or writes your local data.
export default async function setup(project: TestProject): Promise<(() => void) | undefined> {
  let baseUrl = process.env.APP_URL;
  let stop: (() => void) | undefined;

  if (!baseUrl) {
    const entry = "./dist/server/entry.mjs";
    if (!existsSync(entry)) {
      throw new Error(`${entry} not found: run \`pnpm test\`, which builds first, or set APP_URL`);
    }
    const port = await new Promise<number>((resolve) => {
      const probe = createServer();
      probe.listen(0, () => {
        const address = probe.address() as AddressInfo;
        probe.close(() => resolve(address.port));
      });
    });
    const server = spawn("node", [entry], {
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: String(port),
        DATA_DIR: mkdtempSync(join(tmpdir(), "spec-data-")),
      },
      stdio: "ignore",
    });
    stop = () => server.kill();
    baseUrl = `http://127.0.0.1:${port}`;
  }

  // waits up to a minute, since a container can take a while to boot
  for (let attempt = 0; ; attempt++) {
    try {
      await fetch(baseUrl);
      break;
    } catch {
      // not up yet
    }
    if (attempt >= 300) {
      stop?.();
      throw new Error(`nothing is answering at ${baseUrl}: start your app first, or set APP_URL to where it's listening`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  project.provide("baseUrl", baseUrl);
  return stop;
}
