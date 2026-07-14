import { writeFile } from 'node:fs/promises';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTargets(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
    headers: { Host: `localhost:${port}` },
  });
  if (!response.ok) {
    throw new Error(`CDP target list returned HTTP ${response.status}`);
  }
  return response.json();
}

async function findGameTarget(port) {
  const targets = await fetchTargets(port);
  const pages = targets.filter(
    (target) => target.type === 'page' && target.webSocketDebuggerUrl,
  );
  return (
    pages.find((target) =>
      /^https?:\/\/(localhost|127\.0\.0\.1):\d+\/index\.html/i.test(
        target.url ?? '',
      ),
    ) ??
    pages.find((target) =>
      /^https?:\/\/(localhost|127\.0\.0\.1):/i.test(target.url ?? ''),
    ) ??
    pages.find(
      (target) => !/^(about:blank|devtools:|chrome:)/i.test(target.url ?? ''),
    ) ??
    null
  );
}

function flattenFrames(frameTree, output = []) {
  if (!frameTree?.frame) return output;
  output.push(frameTree.frame);
  for (const child of frameTree.childFrames ?? []) {
    flattenFrames(child, output);
  }
  return output;
}

export class CdpClient {
  constructor() {
    this.ws = null;
    this.target = null;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.contexts = new Map();
  }

  on(method, handler) {
    const handlers = this.handlers.get(method) ?? new Set();
    handlers.add(handler);
    this.handlers.set(method, handlers);
    return () => handlers.delete(handler);
  }

  async connect({ port = 8088, timeoutMs = 120_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        this.target = await findGameTarget(port);
        if (this.target) break;
      } catch {
        // CEF is still starting.
      }
      await sleep(1_000);
    }
    if (!this.target) {
      throw new Error(`No game CEF target found on port ${port}`);
    }

    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.target.webSocketDebuggerUrl);
      const timer = setTimeout(
        () => reject(new Error('Timed out opening the CDP WebSocket')),
        15_000,
      );
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        this.ws = ws;
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Failed to open the CDP WebSocket'));
      });
    });

    this.ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      if (message.method === 'Runtime.executionContextCreated') {
        const context = message.params?.context;
        if (context?.id !== undefined) this.contexts.set(context.id, context);
      } else if (message.method === 'Runtime.executionContextDestroyed') {
        this.contexts.delete(message.params?.executionContextId);
      } else if (message.method === 'Runtime.executionContextsCleared') {
        this.contexts.clear();
      }

      for (const handler of this.handlers.get(message.method) ?? []) {
        try {
          handler(message.params);
        } catch {
          // Event observers must not break the protocol client.
        }
      }
    });

    await this.send('Runtime.enable');
    await this.send('Page.enable');
    return this.target;
  }

  send(method, params = {}, timeoutMs = 15_000) {
    if (!this.ws) throw new Error('CDP is not connected');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
    });
  }

  async evaluate(expression, { contextId } = {}) {
    const response = await this.send('Runtime.evaluate', {
      expression: `(${expression})()`,
      returnByValue: true,
      awaitPromise: true,
      ...(contextId === undefined ? {} : { contextId }),
    });
    if (response.exceptionDetails) {
      const detail =
        response.exceptionDetails.exception?.description ??
        response.exceptionDetails.text;
      throw new Error(`CDP evaluation failed: ${detail}`);
    }
    return response.result?.value;
  }

  async waitFor(predicate, { contextId, timeoutMs = 30_000, intervalMs = 500 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await this.evaluate(predicate, { contextId })) return true;
      } catch {
        // The frame may be navigating; retry until the deadline.
      }
      await sleep(intervalMs);
    }
    return false;
  }

  async getWorkshopFrame() {
    const { frameTree } = await this.send('Page.getFrameTree');
    return (
      flattenFrames(frameTree).find((frame) =>
        /\/workshop-hud\//i.test(frame.url ?? ''),
      ) ?? null
    );
  }

  async getFrameContext(frameId) {
    const defaultContext = [...this.contexts.values()].find(
      (context) =>
        context.auxData?.frameId === frameId && context.auxData?.isDefault,
    );
    if (defaultContext) return defaultContext.id;

    const isolated = await this.send('Page.createIsolatedWorld', {
      frameId,
      worldName: 'gestalt-hud-sdk-e2e',
      grantUniveralAccess: true,
    });
    return isolated.executionContextId;
  }

  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(result.data, 'base64'));
    return path;
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // Best effort.
    }
    this.ws = null;
  }
}
