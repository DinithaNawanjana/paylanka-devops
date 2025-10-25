const healthEl = document.getElementById('health');
const rowsEl = document.getElementById('rows');
const reloadBtn = document.getElementById('reload');
const form = document.getElementById('createPayment');
const msg = document.getElementById('msg');

// Nginx will proxy /api to backend, so same origin URLs are fine
async function health() {
  try {
    const r = await fetch('/health');
    const j = await r.json();
    healthEl.textContent = j.ok ? 'api: healthy' : 'api: down';
  } catch {
    healthEl.textContent = 'api: unreachable';
  }
}

async function load() {
  rowsEl.innerHTML = '<tr><td class=\"p-2\" colspan=\"6\">Loading…</td></tr>';
  const r = await fetch('/api/payments');
  const list = await r.json();
  rowsEl.innerHTML = list.map(p => 
    <tr class=\"border-b\">
      <td class=\"p-2\"></td>
      <td class=\"p-2\"></td>
      <td class=\"p-2 text-right\"></td>
      <td class=\"p-2\"></td>
      <td class=\"p-2\"></td>
      <td class=\"p-2\"></td>
    </tr>
  ).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = 'Submitting…';
  const data = new FormData(form);
  const payload = {
    reference: data.get('reference'),
    amount_cents: Math.round(parseFloat(data.get('amount')) * 100),
    currency: 'LKR'
  };
  const r = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (r.ok) { msg.textContent = '✅ Created'; form.reset(); await load(); }
  else { msg.textContent = '❌ Error'; }
});

reloadBtn.addEventListener('click', load);
health(); load();
