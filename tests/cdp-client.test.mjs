import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CdpClient } from '../scripts/cdp-client.mjs';

const frameContext = (id, frameId, isDefault = true) => ({
  id,
  auxData: { frameId, isDefault },
});

test('default frame resolver waits for the page world and never creates an isolated world', async () => {
  const client = new CdpClient();
  const methods = [];
  client.send = async (method) => {
    methods.push(method);
    throw new Error(`Unexpected CDP method: ${method}`);
  };
  client.contexts.set(1, frameContext(1, 'other-frame'));
  client.contexts.set(2, frameContext(2, 'workshop-frame', false));

  setTimeout(() => {
    client.contexts.set(7, frameContext(7, 'workshop-frame'));
  }, 5);

  assert.equal(
    await client.getFrameContext('workshop-frame', {
      timeoutMs: 200,
      intervalMs: 1,
    }),
    7,
  );
  assert.deepEqual(methods, []);

  const source = await readFile(
    new URL('../scripts/cdp-client.mjs', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /Page\.createIsolatedWorld/);
});

test('default frame resolver times out instead of falling back to another world', async () => {
  const client = new CdpClient();
  client.contexts.set(3, frameContext(3, 'workshop-frame', false));

  await assert.rejects(
    client.getFrameContext('workshop-frame', {
      timeoutMs: 10,
      intervalMs: 1,
    }),
    /Timed out waiting for default execution context for frame workshop-frame/,
  );
});

test('frame evaluation reacquires the new default context after navigation', async () => {
  const client = new CdpClient();
  const evaluatedContextIds = [];
  client.contexts.set(11, frameContext(11, 'workshop-frame'));
  client.send = async (method, params) => {
    assert.equal(method, 'Runtime.evaluate');
    evaluatedContextIds.push(params.contextId);
    if (params.contextId === 11) {
      client.contexts.delete(11);
      setTimeout(() => {
        client.contexts.set(22, frameContext(22, 'workshop-frame'));
      }, 5);
      throw new Error('Execution context was destroyed.');
    }
    return { result: { value: 'new-page-world' } };
  };

  assert.equal(
    await client.evaluateInFrame('workshop-frame', '() => "ok"', {
      timeoutMs: 200,
      intervalMs: 1,
    }),
    'new-page-world',
  );
  assert.deepEqual(evaluatedContextIds, [11, 22]);
});

test('frame evaluation does not mask page JavaScript exceptions', async () => {
  const client = new CdpClient();
  const evaluatedContextIds = [];
  client.contexts.set(31, frameContext(31, 'workshop-frame'));
  client.send = async (method, params) => {
    assert.equal(method, 'Runtime.evaluate');
    evaluatedContextIds.push(params.contextId);
    return {
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: 'ReferenceError: missingValue is not defined' },
      },
    };
  };

  await assert.rejects(
    client.evaluateInFrame('workshop-frame', '() => missingValue', {
      timeoutMs: 200,
      intervalMs: 1,
    }),
    /CDP evaluation failed: ReferenceError: missingValue is not defined/,
  );
  assert.deepEqual(evaluatedContextIds, [31]);
});

test('page exceptions that resemble context loss are still not retried', async () => {
  const client = new CdpClient();
  let evaluationCount = 0;
  client.contexts.set(32, frameContext(32, 'workshop-frame'));
  client.send = async (method) => {
    assert.equal(method, 'Runtime.evaluate');
    evaluationCount++;
    return {
      exceptionDetails: {
        text: 'Uncaught',
        exception: { description: 'Error: Execution context was destroyed.' },
      },
    };
  };

  await assert.rejects(
    client.evaluateInFrame('workshop-frame', '() => pageFunction()', {
      timeoutMs: 200,
      intervalMs: 1,
    }),
    /CDP evaluation failed: Error: Execution context was destroyed/,
  );
  assert.equal(evaluationCount, 1);
});

test('frame-aware waitFor resolves the replacement default context', async () => {
  const client = new CdpClient();
  const evaluatedContextIds = [];
  client.contexts.set(41, frameContext(41, 'workshop-frame'));
  client.send = async (method, params) => {
    assert.equal(method, 'Runtime.evaluate');
    evaluatedContextIds.push(params.contextId);
    if (params.contextId === 41) {
      client.contexts.clear();
      setTimeout(() => {
        client.contexts.set(42, frameContext(42, 'workshop-frame'));
      }, 5);
      return { result: { value: false } };
    }
    return { result: { value: true } };
  };

  assert.equal(
    await client.waitFor('() => true', {
      frameId: 'workshop-frame',
      timeoutMs: 200,
      intervalMs: 1,
    }),
    true,
  );
  assert.deepEqual(evaluatedContextIds, [41, 42]);
});
