import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'bra');

const API_KEY = process.env.MF_API_KEY;
const API_BASE = 'https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA';

const MASSIF_IDS = [
  'CHABLAIS', 'ARAVIS', 'MONT-BLANC', 'BAUGES', 'BEAUFORTAIN',
  'HAUTE-TARENTAISE', 'VANOISE', 'HAUTE-MAURIENNE', 'MAURIENNE',
  'CHARTREUSE', 'BELLEDONNE', 'GRANDES-ROUSSES', 'VERCORS', 'OISANS',
  'THABOR', 'PELVOUX', 'QUEYRAS', 'DEVOLUY', 'CHAMPSAUR',
  'EMBRUNAIS-PARPAILLON', 'UBAYE', 'HAUT-VAR-HAUT-VERDON', 'MERCANTOUR'
];

// Check BRA season (November - June)
function isBRASeason() {
  const month = new Date().getMonth() + 1; // 1-12
  return month >= 11 || month <= 6;
}

// Parse XML BRA to structured JSON
function parseBRA(xmlData, massifId) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  const parsed = parser.parse(xmlData);

  // Navigate the XML structure - handle variations
  const bulletin = parsed?.BULLETINS_NEIGE_AVALANCHE || parsed?.BRA || parsed;
  const cartouche = bulletin?.CARTOUCHERISQUE || {};
  const risque = cartouche?.RISQUE || {};
  const pente = cartouche?.PENTE || {};

  // Extract risk levels
  const risks = [];
  const risque1 = parseInt(risque['@_RISQUE1']) || 0;
  const risque2 = parseInt(risque['@_RISQUE2']) || 0;
  const altitude = risque['@_ALTITUDE'] || '';
  const loc1 = risque['@_LOC1'] || '';
  const loc2 = risque['@_LOC2'] || '';

  // Build orientations array from PENTE
  const orientations = [];
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach(dir => {
    if (pente['@_' + dir] === 'true' || pente['@_' + dir] === true) {
      orientations.push(dir);
    }
  });

  if (risque1 && altitude) {
    risks.push({
      altitude: loc1 || '<' + altitude + 'm',
      level: risque1,
      orientations: orientations
    });
  }
  if (risque2) {
    risks.push({
      altitude: loc2 || '>' + altitude + 'm',
      level: risque2,
      orientations: orientations
    });
  } else if (risque1 && !altitude) {
    risks.push({
      altitude: 'Toutes altitudes',
      level: risque1,
      orientations: orientations
    });
  }

  // Extract typical avalanche situations
  const situations = [];
  const accidentalText = (typeof cartouche?.ACCIDENTEL === 'string' ? cartouche.ACCIDENTEL : cartouche?.ACCIDENTEL?.['#text']) || '';
  const naturalText = (typeof cartouche?.NATUREL === 'string' ? cartouche.NATUREL : cartouche?.NATUREL?.['#text']) || '';
  const summaryText = (typeof cartouche?.RESUME === 'string' ? cartouche.RESUME : cartouche?.RESUME?.['#text']) || '';

  // Try to detect situations from text
  const allText = (accidentalText + ' ' + naturalText + ' ' + summaryText).toLowerCase();
  if (allText.includes('neige fraîche') || allText.includes('neige fraiche')) situations.push('neige_fraiche');
  if (allText.includes('plaque') && allText.includes('vent')) situations.push('plaque_vent');
  if (allText.includes('sous-couche') || allText.includes('persistant')) situations.push('sous_couche_fragile');
  if (allText.includes('humide') || allText.includes('fonte')) situations.push('neige_humide');
  if (allText.includes('glissement') || allText.includes('reptation')) situations.push('glissement');

  const stabilityNode = bulletin?.STABILITE;
  const qualityNode = bulletin?.QUALITE;
  const stabilityText = typeof stabilityNode === 'string' ? stabilityNode : stabilityNode?.TEXTE || '';
  const qualityText = typeof qualityNode === 'string' ? qualityNode : qualityNode?.TEXTE || '';

  return {
    massif: massifId,
    date: bulletin?.['@_DATEBULLETIN'] || bulletin?.['@_DATEVALIDITE'] || new Date().toISOString(),
    validUntil: bulletin?.['@_DATEVALIDITE'] || bulletin?.['@_DATEECHEANCE'] || '',
    riskMax: parseInt(risque['@_RISQUEMAXI']) || Math.max(risque1, risque2) || 0,
    risks: risks,
    situations: situations,
    accidental: accidentalText,
    natural: naturalText,
    summary: summaryText,
    snowQuality: qualityText,
    stability: stabilityText
  };
}

async function fetchMassif(massifId) {
  const url = `${API_BASE}?id-massif=${massifId}&format=xml`;
  try {
    const response = await fetch(url, {
      headers: { 'apikey': API_KEY, 'accept': '*/*' }
    });
    if (!response.ok) {
      console.error(`Failed to fetch ${massifId}: ${response.status} ${response.statusText}`);
      return null;
    }
    const xml = await response.text();
    return parseBRA(xml, massifId);
  } catch (error) {
    console.error(`Error fetching ${massifId}:`, error.message);
    return null;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('MF_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!isBRASeason()) {
    console.log('Outside BRA season (Nov-Jun). Skipping fetch.');
    process.exit(0);
  }

  // Ensure output directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log(`Fetching BRA data for ${MASSIF_IDS.length} massifs...`);

  const latest = {
    lastUpdate: new Date().toISOString(),
    massifs: {}
  };

  let successCount = 0;

  // Fetch sequentially to respect rate limits (50/min is generous but let's be nice)
  for (const massifId of MASSIF_IDS) {
    const data = await fetchMassif(massifId);
    if (data) {
      // Write individual massif file
      const filePath = path.join(DATA_DIR, `${massifId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      // Add to latest summary
      latest.massifs[massifId] = {
        risk: data.riskMax,
        date: data.date
      };

      successCount++;
      console.log(`  ✓ ${massifId}: risk ${data.riskMax}`);
    } else {
      console.log(`  ✗ ${massifId}: failed`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Write latest.json
  const latestPath = path.join(DATA_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2));

  console.log(`\nDone: ${successCount}/${MASSIF_IDS.length} massifs fetched successfully.`);

  if (successCount === 0) {
    console.error('No massifs fetched successfully!');
    process.exit(1);
  }
}

main();
