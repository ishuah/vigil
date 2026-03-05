import type { ACLEDEvent } from '../types';

// Parse an ACLED CSV export into ACLEDEvent[]
export function parseACLEDCSV(text: string): ACLEDEvent[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV is empty or has no data rows');

  // Detect separator (comma or semicolon — ACLED exports both)
  const sep = lines[0].includes(';') ? ';' : ',';

  const headers = splitCSVLine(lines[0], sep).map((h) => h.trim().toLowerCase());

  const required = ['actor1', 'actor2', 'event_type'];
  for (const r of required) {
    if (!headers.includes(r)) {
      throw new Error(
        `Missing required column "${r}". Make sure this is an ACLED data export.`,
      );
    }
  }

  const events: ACLEDEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCSVLine(lines[i], sep);
    if (vals.length < headers.length / 2) continue; // skip sparse rows

    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (vals[j] ?? '').trim().replace(/^"|"$/g, '');
    }

    events.push({
      event_id_cnty: row['event_id_cnty'] ?? '',
      event_date: row['event_date'] ?? '',
      year: row['year'] ?? '',
      event_type: row['event_type'] ?? '',
      sub_event_type: row['sub_event_type'] ?? '',
      actor1: row['actor1'] ?? '',
      assoc_actor_1: row['assoc_actor_1'] ?? '',
      inter1: parseInt(row['inter1'] ?? '0', 10) || 0,
      actor2: row['actor2'] ?? '',
      assoc_actor_2: row['assoc_actor_2'] ?? '',
      inter2: parseInt(row['inter2'] ?? '0', 10) || 0,
      interaction: row['interaction'] ?? '',
      country: row['country'] ?? '',
      admin1: row['admin1'] ?? '',
      admin2: row['admin2'] ?? '',
      admin3: row['admin3'] ?? '',
      location: row['location'] ?? '',
      latitude: row['latitude'] ?? '',
      longitude: row['longitude'] ?? '',
      geo_precision: row['geo_precision'] ?? '',
      source: row['source'] ?? '',
      notes: row['notes'] ?? '',
      fatalities: parseInt(row['fatalities'] ?? '0', 10) || 0,
      timestamp: row['timestamp'] ?? '',
    });
  }

  if (events.length === 0) throw new Error('No valid events found in CSV');
  return events;
}

// Handles quoted fields with embedded commas/semicolons
function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
