# Vigil — Specification

## Vision
An open-source, client-side web tool for visualizing armed conflict actor networks using ACLED data. Load conflict data, filter it, and explore who is fighting whom — as an interactive force-directed graph.

No equivalent tool exists. ACLED's own explorer shows dots on a map. Vigil shows the relationships.

---

## Core Loop
```
Connect to ACLED API → Filter → Actor Network Graph → Explore
```

---

## Data Source: ACLED API
- Base URL: `https://api.acleddata.com/acled/read`
- Auth: user provides their own email + API key (free at acleddata.com)
- Credentials stored in localStorage only — never sent to any server except ACLED
- Key ACLED fields used:
  - `actor1`, `actor2` — the two parties in an event
  - `event_type`, `sub_event_type` — type of interaction
  - `event_date` — date of event
  - `country`, `admin1`, `admin2` — location hierarchy
  - `latitude`, `longitude` — coordinates
  - `fatalities` — casualty count
  - `notes` — event description

---

## User Flow

### Step 1 — Connect
- Input fields: ACLED API email + API key
- "Test connection" button — fires a minimal API call to verify credentials
- On success: show green confirmation, proceed to filter step
- Credentials saved to localStorage for return visits

### Step 2 — Filter
- **Region/Country:** multi-select dropdown (all ACLED countries)
- **Date range:** date picker (start → end), presets: Last 30d, 90d, 1yr, 3yr
- **Event types:** checkboxes — Battles, Explosions/Remote violence, Violence against civilians, Protests, Riots, Strategic developments
- **Min interactions:** slider — filter out actor pairs with fewer than N interactions (reduces noise)
- **Max actors:** slider — cap graph size for performance (default 100)
- "Load data" button — fetches from ACLED API with pagination, shows progress
- Shows record count after load: "Loaded 4,823 events across 312 actors"

### Step 3 — Actor Network Graph (main view)
The core visualization. A force-directed graph where:

**Nodes (actors):**
- Size = total event count (more events = bigger node)
- Color = actor type (government forces, rebel groups, civilians, etc.) — inferred from ACLED's `inter1`/`inter2` codes
- Label = actor name (shown on hover, always for top 10 nodes)
- Click → opens Actor Detail Panel

**Edges (interactions):**
- Thickness = interaction frequency (more events = thicker edge)
- Color = dominant event type:
  - Red = Battles
  - Orange = Explosions/Remote violence
  - Dark red = Violence against civilians
  - Yellow = Protests/Riots
  - Gray = Strategic developments
- Hover → tooltip showing: actor pair, event count, fatalities, date range

**Graph controls (top-right panel):**
- Zoom in/out
- Reset layout
- Toggle labels
- Pause/resume simulation

### Step 4 — Actor Detail Panel (right sidebar, opens on node click)
- Actor name + type
- Total events: count + sparkline over time
- Top adversaries: ranked list with event counts
- Event type breakdown: small donut chart
- Recent events: last 5 events with date, type, location, fatalities
- "Show on map" button → opens mini map with this actor's event locations

### Mini Map (optional overlay)
- Small world map showing event locations for selected actor or edge
- Dots sized by fatality count
- Filtered to current date range

---

## Tech Stack
- **Framework:** React + TypeScript
- **Build:** Vite
- **Graph:** D3-force (d3-force, d3-selection, d3-zoom)
- **Mini map:** D3-geo
- **Styling:** Tailwind CSS
- **HTTP:** native fetch (no axios)
- **Storage:** localStorage for credentials + last filter state
- **Export:** html2canvas (PNG export of graph)
- **Tests:** Playwright

100% client-side. Credentials only go to ACLED's API. No backend.

---

## Performance Considerations
- ACLED API is paginated — fetch in batches of 500, show progress
- Graph rendering: limit to max 150 actors by default (configurable)
- D3 force simulation: freeze after convergence to save CPU
- Web Workers: consider offloading force simulation for large graphs (v2)

---

## Non-features (v1)
- No escalation timeline view (v2)
- No protest-to-violence pipeline (v2)
- No multi-country comparison view (v2)
- No server-side proxy (users provide own API key)
- No saved sessions/sharing (v2)
- No mobile layout (desktop-first)

---

## Repo
- New repo: `ishuah/vigil`
- MIT license
- CI: GitHub Actions
- Deploy: GitHub Pages

---

## Actor Type Color Key (from ACLED inter codes)
- 1 = State Forces → Blue
- 2 = Rebel Groups → Red
- 3 = Political Militias → Orange
- 4 = Identity Militias → Purple
- 5 = Rioters → Yellow
- 6 = Protesters → Green
- 7 = Civilians → Gray
- 8 = External/Other Forces → Teal
