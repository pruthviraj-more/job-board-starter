const list = document.getElementById("jobs");
const savedList = document.getElementById("saved");
const savedEmpty = document.getElementById("saved-empty");
const statusEl = document.getElementById("status");
const search = document.getElementById("search");

let currentJobs = [];
let savedJobs = [];

function formatJob(job) {
  return `${job.title} at ${job.company}, ${job.location}. Rs ${job.stipend.toLocaleString("en-IN")} a month.`;
}

function showError(message) {
  statusEl.textContent = message;
  statusEl.hidden = !message;
}

function renderJobs() {
  const savedIds = new Set(savedJobs.map((j) => j.id));
  list.innerHTML = "";

  for (const job of currentJobs) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = formatJob(job);

    const btn = document.createElement("button");
    btn.type = "button";
    const isSaved = savedIds.has(job.id);
    btn.textContent = isSaved ? "Saved" : "Save";
    btn.disabled = isSaved;
    btn.addEventListener("click", () => saveJob(job.id));

    li.append(text, btn);
    list.append(li);
  }
}

function renderSaved() {
  savedList.innerHTML = "";
  savedEmpty.hidden = savedJobs.length > 0;

  for (const job of savedJobs) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = formatJob(job);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => removeJob(job.id));

    li.append(text, btn);
    savedList.append(li);
  }
}

async function loadJobs(query = "") {
  const res = await fetch(`/api/jobs?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Could not load jobs");
  currentJobs = await res.json();
  renderJobs();
}

async function loadSaved() {
  const res = await fetch("/api/saved");
  if (!res.ok) throw new Error("Could not load saved jobs");
  savedJobs = await res.json();
  renderSaved();
  renderJobs();
}

async function saveJob(jobId) {
  showError("");
  const res = await fetch("/api/saved", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.error || "Could not save job");
    return;
  }
  await loadSaved();
}

async function removeJob(jobId) {
  showError("");
  const res = await fetch(`/api/saved/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    showError(data.error || "Could not remove saved job");
    return;
  }
  await loadSaved();
}

search.addEventListener("input", () => {
  loadJobs(search.value).catch((err) => showError(err.message));
});

Promise.all([loadJobs(), loadSaved()]).catch((err) => showError(err.message));
