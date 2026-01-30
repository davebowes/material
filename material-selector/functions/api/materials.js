const JSON_COLS = new Set([
  "sign_types",
  "use_cases",
  "install_methods",
  "laminate_types",
  "surface_finish_options",
  "edge_finish_options",
  "recommended_substrates",
]);

const BOOLISH_COLS = new Set([
  "indoor_use","outdoor_use","temporary","permanent","outdoor_temporary_only",
  "double_sided","double_sided_supported","print_uv_ok","print_latex_ok","print_solvent_ok",
  "lamination_allowed","lamination_required_outdoors","air_egress","can_grommet","can_weld",
  "can_sew","needs_hem","salt_air_ok","requires_slip_laminate"
]);

// Whitelist of columns we allow to be written via admin.
// (D1 won't let us parameterize column names, so this prevents injection.)
const WRITABLE_COLS = new Set([
  "id","category","name","format","tier_hint","thickness","sign_types","use_cases","install_methods","notes",
  "sqft","difficulty","indoor_use","indoor_life","outdoor_use","outdoor_life","temporary","permanent","outdoor_temporary_only",
  "wind","wind_rating_0_5","double_sided","double_sided_supported","max_size","max_width_in","max_height_in",
  "indoor_life_months_min","indoor_life_months_max","outdoor_life_months_min","outdoor_life_months_max",
  "uv_resistance_0_5","water_resistance_0_5","chemical_resistance_0_5","temp_min_f","temp_max_f","humidity_sensitivity_0_5",
  "salt_air_ok","rigidity_0_5","impact_resistance_0_5","warp_risk_0_5","recommended_max_unframed_area_sqft",
  "mounting_requirements","print_uv_ok","print_latex_ok","print_solvent_ok","lamination_allowed","lamination_required_outdoors",
  "laminate_types","surface_finish_options","edge_finish_options","adhesive_type","removal_cleanliness_0_5","conformability_0_5",
  "air_egress","recommended_substrates","can_grommet","can_weld","can_sew","needs_hem","min_install_temp_f",
  "installer_skill_level_1_5","install_time_multiplier","material_cost_sqft","print_cost_sqft","laminate_cost_sqft",
  "waste_factor_percent","setup_fee","preferred_vendor","vendor_sku","lead_time_days","min_order_sqft","roll_width",
  "requires_slip_laminate","max_w_in","max_h_in",
  "uv_resistance_0_10","water_resistance_0_10","chemical_resistance_0_10","humidity_sensitivity_0_10","rigidity_0_10",
  "impact_resistance_0_10","warp_risk_0_10","removal_cleanliness_0_10","conformability_0_10","wind_rating_0_10"
]);

function parseJsonArray(s){
  if (s == null) return s;
  if (Array.isArray(s)) return s;
  const str = String(s).trim();
  if (!str || str === "[]") return [];
  try { return JSON.parse(str); } catch {}
  try { return JSON.parse(str.replace(/'/g, '"')); } catch {}
  return [str];
}

function asBool(v){
  if (v === true || v === false) return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["true","1","yes","y"].includes(s)) return true;
  if (["false","0","no","n"].includes(s)) return false;
  return v;
}

function normalizeOutRow(m){
  const out = { ...m };
  for (const col of JSON_COLS){
    if (col in out) out[col] = parseJsonArray(out[col]);
  }
  for (const col of BOOLISH_COLS){
    if (col in out) out[col] = asBool(out[col]);
  }
  return out;
}

function json(body, status=200){
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function requireAdmin(request, env){
  const token = request.headers.get("x-admin-token") || "";
  const expected = env.ADMIN_TOKEN || "";
  if (!expected) return { ok:false, status: 500, message: "ADMIN_TOKEN not set in environment." };
  if (!token || token !== expected) return { ok:false, status: 401, message: "Unauthorized." };
  return { ok:true };
}

function pickWritable(input){
  const out = {};
  for (const [k,v] of Object.entries(input || {})){
    if (!WRITABLE_COLS.has(k)) continue;
    // Store arrays as JSON strings for D1
    if (JSON_COLS.has(k) && Array.isArray(v)) out[k] = JSON.stringify(v);
    else if (v === "") out[k] = null;
    else out[k] = v;
  }
  return out;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "GET"){
    const { results } = await env.DB.prepare("SELECT * FROM materials").all();
    const materials = results.map(normalizeOutRow);
    return json({ ok:true, total: materials.length, returned: materials.length, limit: 250, offset: 0, materials });
  }

  // Admin methods below
  const admin = requireAdmin(request, env);
  if (!admin.ok) return json({ ok:false, error: admin.message }, admin.status);

  if (method === "POST"){
    const body = await request.json().catch(()=>null);
    if (!body || typeof body !== "object") return json({ ok:false, error:"Invalid JSON body" }, 400);

    const rec = pickWritable(body);
    if (!rec.id) return json({ ok:false, error:"Missing id" }, 400);

    const cols = Object.keys(rec);
    const placeholders = cols.map(()=>"?").join(",");
    const values = cols.map(k=>rec[k]);

    const sql = `INSERT INTO materials (${cols.map(c=>`"${c}"`).join(",")}) VALUES (${placeholders})`;

    try{
      await env.DB.prepare(sql).bind(...values).run();
      return json({ ok:true });
    }catch(e){
      return json({ ok:false, error: e.message }, 400);
    }
  }

  if (method === "PUT"){
    const body = await request.json().catch(()=>null);
    if (!body || typeof body !== "object") return json({ ok:false, error:"Invalid JSON body" }, 400);

    const id = body.id || url.searchParams.get("id");
    if (!id) return json({ ok:false, error:"Missing id" }, 400);

    const rec = pickWritable(body);
    delete rec.id;
    const cols = Object.keys(rec);
    if (!cols.length) return json({ ok:false, error:"No updatable fields provided" }, 400);

    const setClause = cols.map(c=>`"${c}" = ?`).join(", ");
    const values = cols.map(k=>rec[k]);

    const sql = `UPDATE materials SET ${setClause} WHERE id = ?`;

    try{
      const r = await env.DB.prepare(sql).bind(...values, id).run();
      return json({ ok:true, changed: r.changes ?? 0 });
    }catch(e){
      return json({ ok:false, error: e.message }, 400);
    }
  }

  if (method === "DELETE"){
    const id = url.searchParams.get("id") || (await request.json().catch(()=>({}))).id;
    if (!id) return json({ ok:false, error:"Missing id" }, 400);

    try{
      const r = await env.DB.prepare("DELETE FROM materials WHERE id = ?").bind(id).run();
      return json({ ok:true, changed: r.changes ?? 0 });
    }catch(e){
      return json({ ok:false, error: e.message }, 400);
    }
  }

  return json({ ok:false, error:"Method not allowed" }, 405);
}
