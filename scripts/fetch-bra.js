import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'bra');
const DEBUG_DIR = path.join(__dirname, '..', 'data', 'debug');

const API_KEY = process.env.MF_API_KEY;
const API_BASE = 'https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA';

// Mapping: numeric API ID -> massif name
const MASSIFS = {
  1:  'CHABLAIS',
  2:  'ARAVIS',
  3:  'MONT-BLANC',
  4:  'BAUGES',
  5:  'BEAUFORTAIN',
  6:  'HAUTE-TARENTAISE',
  7:  'CHARTREUSE',
  8:  'BELLEDONNE',
  9:  'MAURIENNE',
  10: 'VANOISE',
  11: 'HAUTE-MAURIENNE',
  12: 'GRANDES-ROUSSES',
  13: 'THABOR',
  14: 'VERCORS',
  15: 'OISANS',
  16: 'PELVOUX',
  17: 'QUEYRAS',
  18: 'DEVOLUY',
  19: 'CHAMPSAUR',
  20: 'EMBRUNAIS-PARPAILLON',
  21: 'UBAYE',
  22: 'HAUT-VAR-HAUT-VERDON',
  23: 'MERCANTOUR'
};

function isBRASeason() {
  const month = new Date().getMonth() + 1;
  return month >= 11 || month <= 6;
}

// Helper to safely get text content from a node
function getText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node['#text'] !== undefined) return String(node['#text']);
  if (node.TEXTE !== undefined) return getText(node.TEXTE);
  return '';
}

// Helper to safely get attribute
function getAttr(node, attr) {
  if (!node) return '';
  const val = node['@_' + attr];
  if (val === undefined || val === null) return '';
  return String(val);
}

// Parse enneigement (snow depth) data
function parseEnneigement(node) {
  if (!node) return null;
  const result = {
    altitudeMaxNord: getAttr(node, 'LIM_S') || getAttr(node, 'ALTIMAXIN'),
    altitudeMaxSud: getAttr(node, 'LIM_N') || getAttr(node, 'ALTIMAXIS'),
  };
  // Parse NIVEAU entries (snow depth at altitudes)
  const niveaux = node.NIVEAU;
  if (niveaux) {
    result.niveaux = [];
    const niveauxArr = Array.isArray(niveaux) ? niveaux : [niveaux];
    niveauxArr.forEach(n => {
      result.niveaux.push({
        altitude: getAttr(n, 'ALTI'),
        nord: getAttr(n, 'N'),
        sud: getAttr(n, 'S')
      });
    });
  }
  // ENNEIGEMENT attributes
  if (getAttr(node, 'LIM_S')) result.limiteSkiableNord = getAttr(node, 'LIM_S');
  if (getAttr(node, 'LIM_N')) result.limiteSkiableSud = getAttr(node, 'LIM_N');
  return result;
}

// Parse neige fraiche (fresh snow) data
function parseNeigeFraiche(node) {
  if (!node) return null;
  const result = [];
  const jours = node.NEIGE24H || node.JOUR;
  if (jours) {
    const joursArr = Array.isArray(jours) ? jours : [jours];
    joursArr.forEach(j => {
      result.push({
        date: getAttr(j, 'DATE'),
        altitude: getAttr(j, 'SS241') || getAttr(j, 'ALTITUDESS'),
        quantite: getAttr(j, 'SS242') || getAttr(j, 'NEIGE24')
      });
    });
  }
  return result.length > 0 ? result : null;
}

// Parse meteo data
function parseMeteo(node) {
  if (!node) return null;
  const result = {};
  // ECHEANCE entries (forecast periods)
  const echeances = node.ECHEANCE;
  if (echeances) {
    result.echeances = [];
    const echArr = Array.isArray(echeances) ? echeances : [echeances];
    echArr.forEach(e => {
      result.echeances.push({
        date: getAttr(e, 'DATE'),
        temps: getAttr(e, 'TEMPSSENSIBLE'),
        temperature: getAttr(e, 'TEMPERATURE'),
        iso0: getAttr(e, 'ISO0'),
        pluieNeige: getAttr(e, 'PLUIENEIGE'),
        ventDir: getAttr(e, 'VENTDIR') || getAttr(e, 'DIRVENT'),
        ventVitesse: getAttr(e, 'VENTFORCE') || getAttr(e, 'FFVENT'),
      });
    });
  }
  // Single attributes
  if (getAttr(node, 'ALTITUDEVENT1')) result.altitudeVent1 = getAttr(node, 'ALTITUDEVENT1');
  if (getAttr(node, 'ALTITUDEVENT2')) result.altitudeVent2 = getAttr(node, 'ALTITUDEVENT2');
  return result;
}

// Parse BSH (7-day history)
function parseBSH(node) {
  if (!node) return null;
  const result = {};
  if (node.METEO) result.meteo = parseMeteo(node.METEO);
  if (node.ENNEIGEMENT) result.enneigement = parseEnneigement(node.ENNEIGEMENT);
  if (node.NEIGEFRAICHE) result.neigeFraiche = parseNeigeFraiche(node.NEIGEFRAICHE);
  // RISQUES history
  const risques = node.RISQUES?.RISQUE;
  if (risques) {
    result.risques = [];
    const risquesArr = Array.isArray(risques) ? risques : [risques];
    risquesArr.forEach(r => {
      result.risques.push({
        date: getAttr(r, 'DATE'),
        risqueMax: getAttr(r, 'RISQUEMAXI') || getAttr(r, 'RISQUE_MAXI'),
        evoluRisque: getAttr(r, 'EVOLURISQUE1'),
      });
    });
  }
  return result;
}

// Parse full BRA XML
function parseBRA(xmlData, massifId) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true
  });
  const parsed = parser.parse(xmlData);

  const bulletin = parsed?.BULLETINS_NEIGE_AVALANCHE || parsed?.BRA || parsed;
  const cartouche = bulletin?.CARTOUCHERISQUE || {};
  const risque = cartouche?.RISQUE || {};
  const pente = cartouche?.PENTE || {};

  // Risk levels
  const risks = [];
  const risque1 = parseInt(getAttr(risque, 'RISQUE1')) || 0;
  const risque2 = parseInt(getAttr(risque, 'RISQUE2')) || 0;
  const altitude = getAttr(risque, 'ALTITUDE');
  const loc1 = getAttr(risque, 'LOC1');
  const loc2 = getAttr(risque, 'LOC2');

  // Orientations from PENTE
  const orientations = [];
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach(dir => {
    const val = pente['@_' + dir];
    if (val === 'true' || val === true) orientations.push(dir);
  });

  if (risque1 && altitude) {
    risks.push({ altitude: loc1 || '<' + altitude, level: risque1, orientations });
  }
  if (risque2) {
    risks.push({ altitude: loc2 || '>' + altitude, level: risque2, orientations });
  } else if (risque1 && !altitude) {
    risks.push({ altitude: 'Toutes altitudes', level: risque1, orientations });
  }

  // Situation avalancheuse typique
  const situations = [];
  const situationNode = bulletin?.STABILITE?.SITUATION || cartouche?.SITUATION;
  if (situationNode) {
    const sitText = getText(situationNode).toLowerCase();
    if (sitText) {
      // Map French situation descriptions to codes
      if (sitText.includes('neige fraîche') || sitText.includes('neige fraiche')) situations.push('neige_fraiche');
      if (sitText.includes('vent') || sitText.includes('ventée') || sitText.includes('ventee')) situations.push('plaque_vent');
      if (sitText.includes('sous-couche') || sitText.includes('persistant')) situations.push('sous_couche_fragile');
      if (sitText.includes('humide') || sitText.includes('fonte') || sitText.includes('printani')) situations.push('neige_humide');
      if (sitText.includes('glissement') || sitText.includes('reptation') || sitText.includes('fond')) situations.push('glissement');
    }
  }
  // Fallback: detect from texts
  if (situations.length === 0) {
    const accidentalText = getText(cartouche?.ACCIDENTEL);
    const naturalText = getText(cartouche?.NATUREL);
    const summaryText = getText(cartouche?.RESUME);
    const stabilityText = getText(bulletin?.STABILITE);
    const allText = (accidentalText + ' ' + naturalText + ' ' + summaryText + ' ' + stabilityText).toLowerCase();
    if (allText.includes('neige fraîche') || allText.includes('neige fraiche')) situations.push('neige_fraiche');
    if (allText.includes('plaque') && allText.includes('vent')) situations.push('plaque_vent');
    if (allText.includes('sous-couche') || allText.includes('persistant')) situations.push('sous_couche_fragile');
    if (allText.includes('humide') || allText.includes('fonte')) situations.push('neige_humide');
    if (allText.includes('glissement') || allText.includes('reptation')) situations.push('glissement');
  }

  // Texts
  const accidentalText = getText(cartouche?.ACCIDENTEL);
  const naturalText = getText(cartouche?.NATUREL);
  const summaryText = getText(cartouche?.RESUME);
  const stabilityText = getText(bulletin?.STABILITE);
  const qualityText = getText(bulletin?.QUALITE);
  const situationText = getText(bulletin?.STABILITE?.SITUATION || situationNode);

  // Enneigement
  const enneigement = parseEnneigement(bulletin?.ENNEIGEMENT);

  // Neige fraiche
  const neigeFraiche = parseNeigeFraiche(bulletin?.NEIGEFRAICHE);

  // Meteo
  const meteo = parseMeteo(bulletin?.METEO);

  // BSH (7-day history)
  const bsh = parseBSH(bulletin?.BSH);

  // Tendance (trend)
  const tendance = bulletin?.TENDANCES;
  let tendanceData = null;
  if (tendance) {
    tendanceData = {
      date: getAttr(tendance, 'DATE') || getAttr(tendance?.TENDANCE, 'DATE'),
      risque: getAttr(tendance, 'RISQUE') || getAttr(tendance?.TENDANCE, 'RISQUE') || getText(tendance?.TENDANCE?.RISQUE),
      texte: getText(tendance) || getText(tendance?.TENDANCE)
    };
  }

  // Extract image filenames from XML
  const images = {};
  const imageKeys = ['ImageRisque', 'ImagePente', 'ImageEnneigement', 'ImageNeigeFraiche', 'ImageMeteo', 'Image7derniersjours'];
  imageKeys.forEach(key => {
    const val = getText(bulletin?.[key]);
    if (val) images[key] = val;
  });

  return {
    massif: massifId,
    date: getAttr(bulletin, 'DATEBULLETIN') || getAttr(bulletin, 'DATEVALIDITE') || new Date().toISOString(),
    validUntil: getAttr(bulletin, 'DATEVALIDITE') || getAttr(bulletin, 'DATEECHEANCE') || '',
    riskMax: parseInt(getAttr(risque, 'RISQUEMAXI')) || Math.max(risque1, risque2) || 0,
    risks,
    situations,
    situationText,
    accidental: accidentalText,
    natural: naturalText,
    summary: summaryText,
    snowQuality: qualityText,
    stability: stabilityText,
    enneigement,
    neigeFraiche,
    meteo,
    tendance: tendanceData,
    bsh,
    images
  };
}

async function fetchMassif(numericId, massifName, debugMode = false) {
  const url = `${API_BASE}?id-massif=${numericId}&format=xml`;
  try {
    const response = await fetch(url, {
      headers: { 'apikey': API_KEY, 'accept': '*/*' }
    });
    if (!response.ok) {
      console.error(`Failed to fetch ${massifName} (id=${numericId}): ${response.status} ${response.statusText}`);
      return null;
    }
    const xml = await response.text();

    if (debugMode) {
      // Log XML structure to find image tags
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const parsed = parser.parse(xml);
      const bulletin = parsed?.BULLETINS_NEIGE_AVALANCHE || parsed;
      console.log(`  [debug] XML top-level keys: ${Object.keys(bulletin).join(', ')}`);
      // Log first 500 chars of XML to see structure
      console.log(`  [debug] XML start: ${xml.substring(0, 800).replace(/\n/g, ' ')}`);
      // Look for any key containing "image" or "Image"
      const allKeys = JSON.stringify(Object.keys(bulletin)).toLowerCase();
      console.log(`  [debug] Keys containing 'image': ${Object.keys(bulletin).filter(k => k.toLowerCase().includes('image')).join(', ') || 'NONE'}`);
    }

    return parseBRA(xml, massifName);
  } catch (error) {
    console.error(`Error fetching ${massifName}:`, error.message);
    return null;
  }
}

// Probe different API formats/endpoints for images (first massif only)
async function probeImageEndpoints(numericId) {
  console.log('  [probe] Testing image endpoints...');
  const tests = [
    { label: 'format=png', url: `${API_BASE}?id-massif=${numericId}&format=png` },
    { label: 'format=image', url: `${API_BASE}?id-massif=${numericId}&format=image` },
    { label: 'format=illustration', url: `${API_BASE}?id-massif=${numericId}&format=illustration` },
    { label: '/image endpoint', url: `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/image?id-massif=${numericId}` },
    { label: '/images endpoint', url: `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/images?id-massif=${numericId}` },
    { label: '/massif/BRA/image', url: `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA/image?id-massif=${numericId}` },
  ];
  for (const test of tests) {
    try {
      const resp = await fetch(test.url, {
        headers: { 'apikey': API_KEY, 'accept': '*/*' }
      });
      const ct = resp.headers.get('content-type') || '';
      const len = resp.headers.get('content-length') || '?';
      console.log(`  [probe] ${test.label}: ${resp.status} | content-type: ${ct} | size: ${len}`);
      if (resp.ok && resp.status === 200) {
        const body = await resp.text();
        console.log(`  [probe] ${test.label} body (first 200): ${body.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`  [probe] ${test.label}: ERROR ${e.message}`);
    }
  }
}

// Fetch a binary file from the DPBRA API and save locally
async function fetchBinaryFile(numericId, massifName, format, ext, accept) {
  const url = `${API_BASE}?id-massif=${numericId}&format=${format}`;
  try {
    const response = await fetch(url, {
      headers: { 'apikey': API_KEY, 'accept': accept }
    });
    if (!response.ok) {
      return false;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const filePath = path.join(DATA_DIR, `${massifName}.${ext}`);
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (error) {
    return false;
  }
}

// Download illustration images — try multiple URL patterns
async function fetchImages(numericId, massifName) {
  const IMG_DIR = path.join(DATA_DIR, 'img');
  fs.mkdirSync(IMG_DIR, { recursive: true });

  // Known image types and their filename patterns
  const imageTypes = {
    ImageRisque: `montagne_risques_${numericId}.png`,
    ImagePente: `rose_pentes_${numericId}.png`,
    ImageEnneigement: `montagne_enneigement_${numericId}.png`,
    ImageNeigeFraiche: `graphe_neige_fraiche_${numericId}.png`,
    ImageMeteo: `apercu_meteo_${numericId}.png`,
    Image7derniersjours: `sept_derniers_jours_${numericId}.png`
  };

  // URL patterns to try for each image
  const urlPatterns = (filename) => [
    `${API_BASE}?id-massif=${numericId}&format=image&nom-image=${filename}`,
    `https://public-api.meteofrance.fr/public/DPBRA/v1/massif/BRA/image?id-massif=${numericId}&nom-image=${filename}`,
    `https://public-api.meteofrance.fr/public/DPBRA/v1/image?id-massif=${numericId}&nom-image=${filename}`,
  ];

  const savedImages = {};
  let triedFirst = false;

  for (const [key, filename] of Object.entries(imageTypes)) {
    let saved = false;
    for (const url of urlPatterns(filename)) {
      try {
        const response = await fetch(url, {
          headers: { 'apikey': API_KEY, 'accept': 'image/png' }
        });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('image') || contentType.includes('octet')) {
            const buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > 100) { // Not an error page
              fs.writeFileSync(path.join(IMG_DIR, filename), buffer);
              savedImages[key] = `./data/bra/img/${filename}`;
              saved = true;
              break;
            }
          }
        }
      } catch (e) { /* try next */ }
    }
    // Log result for first massif only
    if (!triedFirst) {
      console.log(`    [img] ${key}: ${saved ? 'OK' : 'not found'}`);
    }
  }
  triedFirst = true;
  return savedImages;
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

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const entries = Object.entries(MASSIFS);
  console.log(`Fetching BRA data for ${entries.length} massifs...`);

  const latest = {
    lastUpdate: new Date().toISOString(),
    massifs: {}
  };

  let successCount = 0;
  let isFirst = true;

  for (const [numericId, massifName] of entries) {
    const data = await fetchMassif(numericId, massifName, isFirst);
    if (isFirst) {
      await probeImageEndpoints(numericId);
    }
    isFirst = false;
    if (data) {
      // Fetch PDF
      const hasPdf = await fetchBinaryFile(numericId, massifName, 'pdf', 'pdf', 'application/pdf');
      data.pdfUrl = hasPdf ? `./data/bra/${massifName}.pdf` : null;

      // Fetch illustration images
      const savedImgs = await fetchImages(numericId, massifName);
      if (Object.keys(savedImgs).length > 0) {
        data.imageUrls = savedImgs;
        console.log(`    ${Object.keys(savedImgs).length} images saved`);
      }

      const filePath = path.join(DATA_DIR, `${massifName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      latest.massifs[massifName] = {
        risk: data.riskMax,
        date: data.date,
        pdfUrl: data.pdfUrl
      };

      successCount++;
      console.log(`  ✓ ${massifName}: risk ${data.riskMax}${hasPdf ? ' [PDF]' : ''}`);
    } else {
      console.log(`  ✗ ${massifName}: failed`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  const latestPath = path.join(DATA_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(latest, null, 2));

  console.log(`\nDone: ${successCount}/${entries.length} massifs fetched successfully.`);

  if (successCount === 0) {
    console.error('No massifs fetched successfully!');
    process.exit(1);
  }
}

main();
