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
  const cutoff = new Date("2025-09-27T23:00:00Z").getTime();
  let page = 1;
  const pageSize = 100;

  let verified = false;
  let match = null;

  while (page <= 50) {
    const url = `https://explorer.testnet3.goat.network/api/v2/addresses/${account}/transactions?filter=to%20%7C%20from&page=${page}&items_count=${pageSize}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      res.status(502).json({ error: "Upstream API error", status: r.status });
      return;
    }

    const data = await r.json();
    const items = data.items || [];

    for (const t of items) {
      const to = t.to?.hash?.toLowerCase();
      const from = t.from?.hash?.toLowerCase();
      const ts = new Date(t.timestamp).getTime();
      const ok = (t.status === "ok" || t.result === "success") && !t.has_error_in_internal_transactions;

      if (ok && (to === contract || from === contract) && ts <= cutoff) {
        verified = true;
        match = { txHash: t.hash, timestamp: t.timestamp };
        break;
      }
    }

    if (verified || items.length < pageSize) break;
    page++;
  }

  res.status(200).json({
    account: account.toLowerCase(),
    verified,
    ...(match ? { timestamp: match.timestamp, tx: match.txHash } : {}),
  });
}
