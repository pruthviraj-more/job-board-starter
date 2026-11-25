// A small job board: a JSON API and one page. Run with `npm start`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { findJob, loadJobs, searchJobs } from "./lib/jobs.js";
import { addSavedId, loadSavedIds, removeSavedId } from "./lib/saved.js";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_BODY_BYTES = 16 * 1024;

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const err = new Error("Request body too large");
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }
}

export function createApp({ jobsPath, savedPath } = {}) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/api/jobs") {
        const jobs = await loadJobs(jobsPath);
        return sendJson(res, 200, searchJobs(jobs, url.searchParams.get("q")));
      }

      if (req.method === "GET" && url.pathname === "/api/saved") {
        const [jobs, savedIds] = await Promise.all([
          loadJobs(jobsPath),
          loadSavedIds(savedPath),
        ]);
        const savedJobs = savedIds
          .map((id) => findJob(jobs, id))
          .filter(Boolean);
        return sendJson(res, 200, savedJobs);
      }

      if (req.method === "POST" && url.pathname === "/api/saved") {
        const body = await readJsonBody(req);
        const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
        if (!jobId) {
          return sendJson(res, 400, { error: "jobId is required" });
        }

        const jobs = await loadJobs(jobsPath);
        const job = findJob(jobs, jobId);
        if (!job) {
          return sendJson(res, 404, { error: `Unknown job id: ${jobId}` });
        }

        const { added } = await addSavedId(jobId, savedPath);
        return sendJson(res, added ? 201 : 200, job);
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/api/saved/")) {
        const rawId = url.pathname.slice("/api/saved/".length);
        const jobId = decodeURIComponent(rawId).trim();
        if (!jobId) {
          return sendJson(res, 400, { error: "jobId is required" });
        }

        const { removed } = await removeSavedId(jobId, savedPath);
        if (!removed) {
          return sendJson(res, 404, { error: `Saved job not found: ${jobId}` });
        }
        return sendJson(res, 200, { removed: jobId });
      }

      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/app.js")) {
        const file = url.pathname === "/" ? "index.html" : "app.js";
        const type = file.endsWith(".html") ? "text/html" : "text/javascript";
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
        return res.end(body);
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (err) {
      if (err && typeof err.status === "number") {
        return sendJson(res, err.status, { error: err.message });
      }
      console.error(err);
      sendJson(res, 500, { error: "Something went wrong" });
    }
  });
}

// Started directly (npm start), not imported by a test.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createApp().listen(PORT, () => console.log(`Job board on http://localhost:${PORT}`));
}
