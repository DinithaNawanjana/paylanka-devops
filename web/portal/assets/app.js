let chart;
const el = (id) => document.getElementById(id);
const fmtLKR = (cents) => (Number(cents||0)/100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function fetchJSON(url, opts) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return { _error: true, _status: r.status, _text: await r.text().catch(()=>null) };
    return await r.json().catch(()=>null);
  } catch {
    return { _error: true, _status: "network" };
  }
}

async function fetchJSONWithFallback(path, opts) {
  const p = await fetchJSON(path, opts);
  if (!p || !p._error) return p;
  const direct = "http://localhost:8000" + (path.startsWith("/") ? path : "/"+path);
  return await fetchJSON(direct, opts);
}

function setStatus(ok, text) {
  const msg = el("msg");
  msg.textContent = (ok ? "✅ " : "❌ ") + (text || (ok ? "OK" : "Error"));
  msg.className = "text-sm " + (ok ? "text-green-600" : "text-rose-600");
}

async function health() {
  const j = await fetchJSONWithFallback("/health");
  const ok = !!(j && j.ok);
  el("healthText").textContent = ok ? "api: healthy" : "api: down";
  el("healthDot").className = "inline-block h-2 w-2 rounded-full " + (ok ? "bg-green-500" : "bg-red-500");
  el("kpiStatus").textContent = ok ? "Healthy" : "Down";
}

async function loadSummary() {
  const s = await fetchJSONWithFallback("/api/summary");
  if (s && !s._error) {
    el("kpiCount").textContent = (s.count || 0).toLocaleString();
    el("kpiSum").textContent = fmtLKR(s.sum_cents);
    const last = Array.isArray(s.last7) ? s.last7 : [];
    const last7Sum = last.reduce((a,b)=>a+Number(b.amount_cents||0),0);
    el("kpiLast7").textContent = fmtLKR(last7Sum);

    const labels = last.map(x => x.reference);
    const values = last.map(x => Number(x.amount_cents||0)/100);
    const ctx = document.getElementById("chart");
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "bar",
      data: { labels, datasets: [{ label: "Amount (LKR)", data: values }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

async function loadTable(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const list = await fetchJSONWithFallback(`/api/payments${qs}`);
  const safe = Array.isArray(list) ? list : [];
  const rows = safe.map(p => `
    <tr class="border-b hover:bg-gray-50">
      <td class="p-2">${p.id}</td>
      <td class="p-2 font-medium">${p.reference}</td>
      <td class="p-2 text-right">${fmtLKR(p.amount_cents)}</td>
      <td class="p-2">${p.currency||"LKR"}</td>
      <td class="p-2">${p.status||"SUCCESS"}</td>
      <td class="p-2">${p.created_at ? new Date(p.created_at).toLocaleString() : "-"}</td>
      <td class="p-2 text-right">
        <button data-id="${p.id}" class="text-red-600 hover:underline delete-btn">Delete</button>
      </td>
    </tr>`).join("");
  el("rows").innerHTML = rows || `<tr><td class="p-2" colspan="7">No records</td></tr>`;
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (!confirm(`Delete payment #${id}?`)) return;
      await fetchJSONWithFallback(`/api/payments/${id}`, { method: "DELETE" });
      await refreshAll();
    });
  });
}

async function createPayment(ev) {
  ev.preventDefault();
  const data = new FormData(ev.currentTarget);
  const reference = String(data.get("reference")||"").trim();
  const amount = Number(data.get("amount")||0);

  if (!reference) { setStatus(false, "reference required"); return; }
  if (!Number.isFinite(amount) || amount <= 0) { setStatus(false, "amount must be > 0"); return; }

  setStatus(true, "Submitting…");

  // send via proxy, then direct fallback
  let r = await fetchJSON("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, amount_cents: Math.round(amount*100), currency: "LKR" })
  });
  if (r && r._error) {
    r = await fetchJSON("http://localhost:8000/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, amount_cents: Math.round(amount*100), currency: "LKR" })
    });
  }

  if (r && !r._error) {
    setStatus(true, "Created");
    ev.currentTarget.reset();
    try { await refreshAll(); } catch {}
    setTimeout(()=> el("msg").textContent = "", 1400);
  } else {
    // show exact reason if API sent JSON error, else show HTTP code/body
    try {
      const tryProxy = await fetch("/api/payments?q="+encodeURIComponent(reference));
      const wasInserted = tryProxy.ok && (await tryProxy.json()).some(x => x.reference === reference);
      if (wasInserted) {
        setStatus(true, "Created (verified)");
        try { await refreshAll(); } catch {}
        setTimeout(()=> el("msg").textContent = "", 1400);
        return;
      }
    } catch {}
    const httpInfo = r?._status ? ` (HTTP ${r._status})` : "";
    const bodyInfo = r?._text ? `: ${r._text}` : "";
    setStatus(false, `Error${httpInfo}${bodyInfo}`);
  }
}

function debounce(fn, ms){let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)};}
async function refreshAll(){ await Promise.all([loadSummary(), loadTable(el("search").value || "")]); }
function wireUI(){ document.getElementById("createPayment").addEventListener("submit", createPayment);
  document.getElementById("refreshAll").addEventListener("click", refreshAll);
  document.getElementById("search").addEventListener("input", debounce(()=> loadTable(el("search").value || ""), 300)); }
(async function start(){ wireUI(); await health(); await refreshAll(); })();
