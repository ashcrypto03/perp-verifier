// api/perp.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const { account } = req.query;
  if (!account) {
    res.status(400).json({ error: "Missing account" });
    return;
  }

  const contract = "0xC01a5c5f1a2a70eC6a461447651452C53B78846b".toLowerCase();
  const cutoffMs = new Date("2025-09-27T23:00:00Z").getTime();

  const maxPages = 200;   // safety cap
  const pageSize = 100;

  let page = 1;
  let earliest = null;    // { tsMs, timestamp, tx }

  while (page <= maxPages) {
    const url =
      `https://explorer.testnet3.goat.network/api/v2/addresses/${account}` +
      `/transactions?filter=to%20%7C%20from&page=${page}&items_count=${pageSize}`;

    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      res.status(502).json({ error: "Upstream API error", status: r.status });
      return;
    }

    const data = await r.json();
    const items = Array.isArray(data.items) ? data.items : [];

    for (const t of items) {
      const ok = (t.status === "ok" || t.result === "success") &&
                 !t.has_error_in_internal_transactions;
      const to = t.to?.hash?.toLowerCase();
      const from = t.from?.hash?.toLowerCase();
      const touchesPerp = to === contract || from === contract;
      if (!ok || !touchesPerp) continue;

      const tsMs = Date.parse(t.timestamp); // ISO → ms
      if (!earliest || tsMs < earliest.tsMs) {
        earliest = { tsMs, timestamp: t.timestamp, tx: t.hash };
      }
    }

    if (items.length < pageSize) break; // last page
    page++;
  }

  const hasTx = Boolean(earliest);
  const verified = hasTx && earliest.tsMs <= cutoffMs;

  res.status(200).json({
    account: String(account).toLowerCase(),
    verified,
    ...(hasTx ? { firstTx: { timestamp: earliest.timestamp, tx: earliest.tx } } : {})
  });
}
