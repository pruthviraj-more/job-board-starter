# Job board starter

A small job board for an insiderOne work sample. It is made up: the jobs and
companies are not real.

## Run it

You need Node 20 or newer. There are no packages to install.

```
npm start      # then open http://localhost:3000
npm test       # runs the tests in test/
```

## What is here

- `server.js`: the web server. `GET /api/jobs?q=` lists jobs, `GET /` serves the page.
- `lib/jobs.js`: reading and searching the jobs. Pure functions.
- `jobs.json`: the jobs.
- `public/`: the page and its script.
- `test/`: tests, using Node's built-in test runner.

## Your task

See the work sample brief on insiderOne: add saved jobs (save, list, remove),
with tests, and add a short section to this README about what you built.

## Saved jobs (added)

### What was built

- `lib/saved.js`: reads and writes saved job IDs to `saved.json` (creating it on first save and keeping writes sequential so concurrent saves don't overwrite each other).
- `server.js`: added `GET /api/saved`, `POST /api/saved` (with `{ "jobId": "..." }`), and `DELETE /api/saved/:jobId`. Unknown job IDs return `404`, invalid requests return `400`, and saving the same job twice keeps a single copy.
- `public/index.html` and `public/app.js`: added a **Save** button to each job in the list, a **Saved jobs** section on the same page, and a **Remove** button on each saved job. Saved jobs reload from the server on refresh.
- `test/saved.test.js`: unit tests for `lib/saved.js` and HTTP tests for the `/api/saved` endpoints using Node's built-in test runner.

### How to run it and the tests

```
npm start      # starts the server on http://localhost:3000
npm test       # runs all tests in test/ (jobs + saved)
```

### One decision and why

I stored only the array of saved `jobId` strings in `saved.json` instead of copying the full job objects, and resolved them against `jobs.json` when serving `GET /api/saved`. That avoids stale data if a job's title or stipend changes later, and keeps `saved.json` tiny and easy to inspect.

### What I would do next

- Scope saved jobs per user (with a session or account) instead of a single shared `saved.json` file.
- Write `saved.json` atomically via a temp file and rename so a crash mid-write cannot leave a half-written JSON file.
