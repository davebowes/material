export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT * FROM materials").all();

  const jsonCols = new Set([
    "sign_types",
    "use_cases",
    "install_methods",
    "laminate_types",
    "surface_finish_options",
    "edge_finish_options",
    "recommended_substrates",
  ]);

  const boolish = new Set([
    "indoor_use","outdoor_use","temporary","permanent","outdoor_temporary_only",
    "double_sided","double_sided_supported","print_uv_ok","print_latex_ok","print_solvent_ok",
    "lamination_allowed","lamination_required_outdoors","air_egress","can_grommet","can_weld",
    "can_sew","needs_hem","salt_air_ok","requires_slip_laminate"
  ]);

  function parseJsonArray(s){
    if (s == null) return s;
    if (Array.isArray(s)) return s;
    const str = String(s).trim();
    if (!str || str === "[]") return [];
    try { return JSON.parse(str); } catch {}
    // handle old python/single-quote list strings
    try { return JSON.parse(str.replace(/'/g, '"')); } catch {}
    return [str];
  }

  function asBool(v){
    if (v === true || v === false) return v;
    const s = String(v ?? "").trim().toLowerCase();
    if (["true","1","yes","y"].includes(s)) return true;
    if (["false","0","no","n"].includes(s)) return false;
    return v; // leave as-is
  }

  const materials = results.map((m) => {
    const out = { ...m };

    for (const col of jsonCols) {
      if (col in out) out[col] = parseJsonArray(out[col]);
    }

    for (const col of boolish) {
      if (col in out) out[col] = asBool(out[col]);
    }

    return out;
  });

  return new Response(JSON.stringify(materials), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
