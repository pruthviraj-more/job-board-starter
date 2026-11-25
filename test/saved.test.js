import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";
import { addSavedId, loadSavedIds, removeSavedId } from "../lib/saved.js";

async function withTempSavedFile(fn) {
  const dir = await mkdtemp(join(tmpdir(), "job-board-test-"));
  const savedPath = join(dir, "saved.json");
  try {
    await fn(savedPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withServer(savedPath, fn) {
  const server = createApp({ savedPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("saved store starts empty, avoids duplicates, and removes ids", async () => {
  await withTempSavedFile(async (savedPath) => {
    assert.deepEqual(await loadSavedIds(savedPath), []);

    const first = await addSavedId("j1", savedPath);
    assert.equal(first.added, true);
    assert.deepEqual(first.ids, ["j1"]);

    const duplicate = await addSavedId("j1", savedPath);
    assert.equal(duplicate.added, false);
    assert.deepEqual(duplicate.ids, ["j1"]);

    await addSavedId("j3", savedPath);
    assert.deepEqual(await loadSavedIds(savedPath), ["j1", "j3"]);

    const removed = await removeSavedId("j1", savedPath);
    assert.equal(removed.removed, true);
    assert.deepEqual(removed.ids, ["j3"]);

    const missing = await removeSavedId("j999", savedPath);
    assert.equal(missing.removed, false);
    assert.deepEqual(missing.ids, ["j3"]);
  });
});

test("POST, GET, and DELETE /api/saved manage saved jobs and persist to disk", async () => {
  await withTempSavedFile(async (savedPath) => {
    await withServer(savedPath, async (baseUrl) => {
      const initial = await fetch(`${baseUrl}/api/saved`);
      assert.equal(initial.status, 200);
      assert.deepEqual(await initial.json(), []);

      const saveRes = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "j2" }),
      });
      assert.equal(saveRes.status, 201);
      const savedJob = await saveRes.json();
      assert.equal(savedJob.id, "j2");
      assert.equal(savedJob.company, "Kite Learning");

      // Saving the same job twice should keep a single copy.
      const dupRes = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "j2" }),
      });
      assert.equal(dupRes.status, 200);

      const listRes = await fetch(`${baseUrl}/api/saved`);
      const list = await listRes.json();
      assert.deepEqual(list.map((j) => j.id), ["j2"]);
    });

    // A fresh server reading the same file still sees the saved job.
    await withServer(savedPath, async (baseUrl) => {
      const listRes = await fetch(`${baseUrl}/api/saved`);
      const list = await listRes.json();
      assert.deepEqual(list.map((j) => j.id), ["j2"]);

      const delRes = await fetch(`${baseUrl}/api/saved/j2`, { method: "DELETE" });
      assert.equal(delRes.status, 200);
      assert.deepEqual(await delRes.json(), { removed: "j2" });

      const afterDel = await fetch(`${baseUrl}/api/saved`);
      assert.deepEqual(await afterDel.json(), []);
    });
  });
});

test("saved API returns clear errors for unknown ids, bad input, and missing deletes", async () => {
  await withTempSavedFile(async (savedPath) => {
    await withServer(savedPath, async (baseUrl) => {
      const unknownRes = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: "does-not-exist" }),
      });
      assert.equal(unknownRes.status, 404);
      const unknownBody = await unknownRes.json();
      assert.match(unknownBody.error, /unknown job id/i);

      const emptyRes = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(emptyRes.status, 400);
      assert.ok((await emptyRes.json()).error);

      const badJsonRes = await fetch(`${baseUrl}/api/saved`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      assert.equal(badJsonRes.status, 400);
      assert.ok((await badJsonRes.json()).error);

      const missingDel = await fetch(`${baseUrl}/api/saved/j2`, { method: "DELETE" });
      assert.equal(missingDel.status, 404);
      assert.ok((await missingDel.json()).error);
    });
  });
});
