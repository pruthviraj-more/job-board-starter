const list = document.getElementById("jobs");
const search = document.getElementById("search");

async function show(query = "") {
  const res = await fetch(`/api/jobs?q=${encodeURIComponent(query)}`);
  const jobs = await res.json();
  list.innerHTML = "";
  for (const job of jobs) {
    const li = document.createElement("li");
    li.textContent = `${job.title} at ${job.company}, ${job.location}. Rs ${job.stipend.toLocaleString("en-IN")} a month.`;
    list.append(li);
  }
}

search.addEventListener("input", () => show(search.value));
show();
