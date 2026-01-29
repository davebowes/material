function safeJson(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (typeof v === "bigint") {
      // If it's within safe integer range, convert to Number; otherwise string it.
      const n = Number(v);
      return Number.isSafeInteger(n) ? n : v.toString();
    }
    return v;
  });
}

export async function onRequestGet({ env, request }) {
  try {
    if (!env?.DB) {
      return new Response(
        safeJson({
          error: "Missing D1 binding",
          fix: "Pages → Settings → Functions → add D1 binding named DB",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    // Confirm table exists
    const table = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='materials'"
    ).first();

    if (!table) {
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      ).all();

      return new Response(
        safeJson({
          error: "Table 'materials' not found in bound DB",
          tables_found: (tables.results || []).map((t) => t.name),
          fix: "Run db/schema_and_seed.sql in the SAME D1 DB bound to Pages as DB",
        }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    // Pagination (prevents huge responses)
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "250", 10), 1), 1000);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const countRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM materials").first();
    const total = Number(countRow?.c ?? 0);

    const { results } = await env.DB
      .prepare("SELECT * FROM materials LIMIT ? OFFSET ?")
      .bind(limit, offset)
      .all();

    return new Response(
      safeJson({
        ok: true,
        total,
        limit,
        offset,
        returned: results.length,
        materials: results,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  } catch (err) {
    return new Response(
      safeJson({
        error: "Worker exception",
        detail: String(err),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
