import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data', 'bra');
const IMG_DIR = path.join(DATA_DIR, 'img');

const API_KEY = process.env.MF_API_KEY;
const API_BASE = 'https://public-api.meteofrance.fr/public/DPBRA/v1';

const MASSIFS = {
  1: 'CHABLAIS', 2: 'ARAVIS', 3: 'MONT-BLANC', 4: 'BAUGES',
  5: 'BEAUFORTAIN', 6: 'HAUTE-TARENTAISE', 7: 'CHARTREUSE', 8: 'BELLEDONNE',
  9: 'MAURIENNE', 10: 'VANOISE', 11: 'HAUTE-MAURIENNE', 12: 'GRANDES-ROUSSES',
  13: 'THABOR', 14: 'VERCORS', 15: 'OISANS', 16: 'PELVOUX',
  17: 'QUEYRAS', 18: 'DEVOLUY', 19: 'CHAMPSAUR', 20: 'EMBRUNAIS-PARPAILLON',
  21: 'UBAYE', 22: 'HAUT-VAR-HAUT-VERDON', 23: 'MERCANTOUR'
};

const IMAGE_TYPES = [
  'montagne-risques', 'rose-pentes', 'montagne-enneigement',
  'graphe-neige-fraiche', 'apercu-meteo', 'sept-derniers-jours'
];

function isBRASeason() {
  const month = new Date().getMonth() + 1;
  return month >= 11 || month <= 6;
}

function getText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node['#text'] !== undefined) return String(node['#text']);
  if (node.TEXTE !== undefined) return getText(node.TEXTE);
  return '';
}

function getAttr(node, attr) {
  if (!node) return '';
  const val = node['@_' + attr];
  return (val === undefined || val === null) ? '' : String(val);
}

// ── XML Parsing ──

function parseBRA(xmlData, massifId) {
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_',
    textNodeName: '#text', trimValues: true
  });
  const parsed = parser.parse(xmlData);
  const bulletin = parsed?.BULLETINS_NEIGE_AVALANCHE || parsed;
  const cartouche = bulletin?.CARTOUCHERISQUE || {};
  const risque = cartouche?.RISQUE || {};
  const pente = cartouche?.PENTE || {};

  // Risks
  const risks = [];
  const r1 = parseInt(getAttr(risque, 'RISQUE1')) || 0;
  const r2 = parseInt(getAttr(risque, 'RISQUE2')) || 0;
  const alt = getAttr(risque, 'ALTITUDE');
  const loc1 = getAttr(risque, 'LOC1');
  const loc2 = getAttr(risque, 'LOC2');

  const orientations = [];
  ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach(dir => {
    if (pente['@_' + dir] === 'true' || pente['@_' + dir] === true) orientations.push(dir);
  });

  if (r1 && alt) risks.push({ altitude: loc1 || '<' + alt, level: r1, orientations });
  if (r2) risks.push({ altitude: loc2 || '>' + alt, level: r2, orientations });
  else if (r1 && !alt) risks.push({ altitude: 'Toutes altitudes', level: r1, orientations });

  // Situations
  const situations = [];
  const allText = [getText(cartouche?.ACCIDENTEL), getText(cartouche?.NATUREL),
    getText(cartouche?.RESUME), getText(bulletin?.STABILITE)].join(' ').toLowerCase();
  if (allText.includes('neige fraîche') || allText.includes('neige fraiche')) situations.push('neige_fraiche');
  if (allText.includes('plaque') && allText.includes('vent')) situations.push('plaque_vent');
  if (allText.includes('sous-couche') || allText.includes('persistant')) situations.push('sous_couche_fragile');
  if (allText.includes('humide') || allText.includes('fonte')) situations.push('neige_humide');
  if (allText.includes('glissement') || allText.includes('reptation')) situations.push('glissement');

  return {
    massif: massifId,
    date: getAttr(bulletin, 'DATEBULLETIN') || new Date().toISOString(),
    validUntil: getAttr(bulletin, 'DATEVALIDITE') || '',
    riskMax: parseInt(getAttr(risque, 'RISQUEMAXI')) || Math.max(r1, r2) || 0,
    risks, situations,
    summary: getText(cartouche?.RESUME),
    stability: getText(bulletin?.STABILITE),
    snowQuality: getText(bulletin?.QUALITE),
  };
}

// ── API Fetching ──

async function fetchXML(numericId, massifName, retries = 2) {
  const url = `${API_BASE}/massif/BRA?id-massif=${numericId}&format=xml`;
  try {
    const resp = await fetch(url, { headers: { 'apikey': API_KEY, 'accept': '*/*' } });
    if ((resp.status === 429 || resp.status >= 500) && retries > 0) {
      await sleep(5000);
      return fetchXML(numericId, massifName, retries - 1);
    }
    if (!resp.ok) { console.error(`  XML ${massifName}: ${resp.status}`); return null; }
    return parseBRA(await resp.text(), massifName);
  } catch (e) { console.error(`  XML ${massifName}: ${e.message}`); return null; }
}

async function fetchPDF(numericId, massifName, retries = 2) {
  await sleep(1300);
  const url = `${API_BASE}/massif/BRA?id-massif=${numericId}&format=pdf`;
  try {
    const resp = await fetch(url, { headers: { 'apikey': API_KEY, 'accept': 'application/pdf' } });
    if ((resp.status === 429 || resp.status >= 500) && retries > 0) { await sleep(5000); return fetchPDF(numericId, massifName, retries - 1); }
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(path.join(DATA_DIR, `${massifName}.pdf`), buffer);
    return `./data/bra/${massifName}.pdf`;
  } catch (e) { return null; }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchImage(numericId, type, retries = 2) {
  const url = `${API_BASE}/massif/image/${type}?id-massif=${numericId}`;
  try {
    const resp = await fetch(url, { headers: { 'apikey': API_KEY, 'accept': '*/*' } });
    if ((resp.status === 429 || resp.status >= 500) && retries > 0) { await sleep(5000); return fetchImage(numericId, type, retries - 1); }
    if (!resp.ok) return false;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 500) return false;
    const filename = `${type}_${numericId}.png`;
    fs.writeFileSync(path.join(IMG_DIR, filename), buffer);
    return `./data/bra/img/${filename}`;
  } catch (e) { return false; }
}

async function fetchAllImages(numericId) {
  const result = {};
  for (const type of IMAGE_TYPES) {
    const imgPath = await fetchImage(numericId, type);
    if (imgPath) result[type] = imgPath;
    await sleep(1300); // stay under 50 req/min
  }
  return result;
}

// ── Main ──

async function main() {
  if (!API_KEY) { console.error('MF_API_KEY required'); process.exit(1); }
  if (!isBRASeason()) { console.log('Outside BRA season.'); process.exit(0); }

  fs.mkdirSync(IMG_DIR, { recursive: true });

  const entries = Object.entries(MASSIFS);
  console.log(`Fetching BRA for ${entries.length} massifs...`);

  const latest = { lastUpdate: new Date().toISOString(), massifs: {} };
  let ok = 0;

  for (const [id, name] of entries) {
    const data = await fetchXML(id, name);
    if (!data) { console.log(`  ✗ ${name}`); continue; }

    data.pdfUrl = await fetchPDF(id, name);
    data.imageUrls = await fetchAllImages(id);

    fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2));
    latest.massifs[name] = {
      risk: data.riskMax, date: data.date,
      img: data.imageUrls || {}
    };

    const imgCount = Object.keys(data.imageUrls).length;
    console.log(`  ✓ ${name}: risk ${data.riskMax} | ${imgCount} imgs${data.pdfUrl ? ' | PDF' : ''}`);
    ok++;

    await sleep(1300);
  }

  fs.writeFileSync(path.join(DATA_DIR, 'latest.json'), JSON.stringify(latest, null, 2));
  console.log(`\nDone: ${ok}/${entries.length}`);
  if (ok === 0) process.exit(1);
}

main();
