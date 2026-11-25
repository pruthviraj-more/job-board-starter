import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_SAVED_PATH = new URL("../saved.json", import.meta.url);

// Keep writes sequential so back-to-back saves don't overwrite each other.
let writeQueue = Promise.resolve();

export async function loadSavedIds(path = DEFAULT_SAVED_PATH) {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeSavedIds(ids, path = DEFAULT_SAVED_PATH) {
  const next = writeQueue.then(() =>
    writeFile(path, JSON.stringify(ids, null, 2) + "\n", "utf8")
  );
  writeQueue = next.catch(() => {});
  return next;
}

export async function addSavedId(jobId, path = DEFAULT_SAVED_PATH) {
  const ids = await loadSavedIds(path);
  if (ids.includes(jobId)) {
    return { ids, added: false };
  }
  const updated = [...ids, jobId];
  await writeSavedIds(updated, path);
  return { ids: updated, added: true };
}

export async function removeSavedId(jobId, path = DEFAULT_SAVED_PATH) {
  const ids = await loadSavedIds(path);
  if (!ids.includes(jobId)) {
    return { ids, removed: false };
  }
  const updated = ids.filter((id) => id !== jobId);
  await writeSavedIds(updated, path);
  return { ids: updated, removed: true };
}
