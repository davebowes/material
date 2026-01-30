# FASTSIGNS Material Selector (Cloudflare Pages + D1) — Full Starter Package

This package deploys a FASTSIGNS-branded Material Selector app backed by a Cloudflare **D1** database.

## UX rules
- **Required:** Sign Type + Location (Indoor/Outdoor)
- **Recommended (not required):** Size + Qty (enables cost/panels/seams)
- **Optional:** Advanced refinements (collapsible menu)
- Output: **Good / Better / Best** + **Overall Best** (tie-breaker: lower cost)

---

## Repo contents
- `index.html` — Frontend
- `fastsigns-logo.png` — Branding logo (place at root)
- `functions/api/materials.js` — Pages Function API: `/api/materials`
- `db/schema_and_seed.sql` — Creates + seeds D1 table `materials`

---

## 1) Create GitHub repo
1. Create a new GitHub repo.
2. Upload all files from this folder (or push via git).
3. Keep this structure:
```
/
  index.html
  fastsigns-logo.png
  /functions/api/materials.js
  /db/schema_and_seed.sql
```

---

## 2) Create the D1 database (Cloudflare)
1. Cloudflare Dashboard → **Workers & Pages** → **D1**
2. **Create database**
3. Name: `fastsigns-materials`

### Seed the database (Dashboard method)
1. Open the new DB → **Console**
2. Paste the full contents of `db/schema_and_seed.sql`
3. Run

### Verify seed worked
```sql
SELECT COUNT(*) AS row_count FROM materials;
```

---

## 3) Create Cloudflare Pages project
1. Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Create project**
2. Connect your GitHub repo
3. Build settings:
   - Framework preset: **None**
   - Build command: *(blank)*
   - Output directory: *(blank)*
4. Deploy

---

## 4) Bind D1 to Pages Functions
1. Pages project → **Settings** → **Functions**
2. Add **D1 database binding**
   - Variable name: `DB`
   - Database: `fastsigns-materials`
3. Save
4. Redeploy (push a tiny commit if needed)

---

## 5) Test end-to-end
### API test
Visit:
`https://<your-pages-url>/api/materials`

You should see JSON.

### App test
Visit the homepage. Top-right should show:
`Loaded <N> materials from database.`

---

## Common fixes
- `/api/materials` returns **500** → D1 binding missing or not named exactly `DB`
- `/api/materials` returns **[]** → seed didn’t run; re-run `schema_and_seed.sql`
- UI shows 0 but API has data → DevTools → Network → `/api/materials`

