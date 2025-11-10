export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvContent(csvText: string): ParsedCsv {
  const rawLines = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.startsWith("#"));
  
  if (rawLines.length < 2) {
    return { headers: [], rows: [] };
  }
  
  const headers = parseCsvLine(rawLines[0]);
  const rows = rawLines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .filter((cols) => cols.length === headers.length);
  
  return { headers, rows };
}

export function extractUnit(headerName: string): string | null {
  // Try to extract unit from common patterns:
  // "temperature (degree_C)" -> "degree_C"
  // "salinity (PSU)" -> "PSU"
  const match = headerName.match(/\(([^)]+)\)/);
  if (match) {
    return match[1].trim();
  }
  
  // Common variable name to unit mappings if no parentheses
  const commonUnits: Record<string, string> = {
    'temperature': 'degree_C',
    'temp': 'degree_C',
    'salinity': 'PSU',
    'pressure': 'dbar',
    'depth': 'm',
    'oxygen': 'umol/kg',
    'chlorophyll': 'mg/m^3',
    'ph': 'pH',
  };
  
  const normalized = headerName.toLowerCase();
  for (const [key, unit] of Object.entries(commonUnits)) {
    if (normalized.includes(key)) {
      return unit;
    }
  }
  
  return null; // No unit found
}

export function encodeBase64(str: string): string {
  if (!str) {
    return "";
  }
  const utf8 = new TextEncoder().encode(str);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function transformSandboxLinks(text: string): string {
  if (!text) {
    return text;
  }
  return text.replace(/\[([^\]]+)\]\(sandbox:[^)]+\)/g, "$1 (download available below)");
}

export const colorPalette = [
  { border: '#003478', background: 'rgba(0, 52, 120, 0.1)' },      // Blue
  { border: '#16a085', background: 'rgba(22, 160, 133, 0.1)' },    // Green
  { border: '#e67e22', background: 'rgba(230, 126, 34, 0.1)' },    // Orange
  { border: '#c0392b', background: 'rgba(192, 57, 43, 0.1)' },     // Red
  { border: '#8e44ad', background: 'rgba(142, 68, 173, 0.1)' },    // Purple
  { border: '#1abc9c', background: 'rgba(26, 188, 156, 0.1)' },    // Teal
  { border: '#f39c12', background: 'rgba(243, 156, 18, 0.1)' },    // Yellow
  { border: '#e91e63', background: 'rgba(233, 30, 99, 0.1)' }      // Pink
];

