const CONFIG = {
  MAP_CENTER: [45.2, 6.7],
  MAP_ZOOM: 8,
  MIN_ZOOM: 6,
  MAX_ZOOM: 18,
  TILE_URL: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: 'Carte: © <a href="https://opentopomap.org">OpenTopoMap</a> | Données: © <a href="https://openstreetmap.org">OpenStreetMap</a> | BRA: © <a href="https://meteofrance.com">Météo-France</a>',
  IGN_TOPO_URL: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  IGN_TOPO_ATTRIBUTION: 'Carte: © <a href="https://www.ign.fr/">IGN</a>',
  SLOPES_URL: 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.SLOPES.MOUNTAIN&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  SLOPES_ATTRIBUTION: 'Pentes: © <a href="https://www.ign.fr/">IGN</a>',
  DATA_BASE_URL: './data/bra/',
  GEOJSON_URL: './data/massifs.geojson'
};

const RISK_COLORS = {
  1: '#52B788',  // Faible - green
  2: '#FFD60A',  // Limité - yellow
  3: '#FF9500',  // Marqué - orange
  4: '#FF3B30',  // Fort - red
  5: '#1C1C1E'   // Très fort - black
};

const RISK_LABELS = {
  1: 'Faible',
  2: 'Limité',
  3: 'Marqué',
  4: 'Fort',
  5: 'Très fort'
};

const RISK_TEXT_COLORS = {
  1: '#FFFFFF',
  2: '#000000',
  3: '#FFFFFF',
  4: '#FFFFFF',
  5: '#FFFFFF'
};

// All 23 Alpine massifs (Alpes du Nord + Alpes du Sud)
const MASSIFS = {
  // Alpes du Nord
  'CHABLAIS': { name: 'Chablais', zone: 'alpes-nord', dept: '74' },
  'ARAVIS': { name: 'Aravis', zone: 'alpes-nord', dept: '74' },
  'MONT-BLANC': { name: 'Mont-Blanc', zone: 'alpes-nord', dept: '74' },
  'BAUGES': { name: 'Bauges', zone: 'alpes-nord', dept: '73' },
  'BEAUFORTAIN': { name: 'Beaufortain', zone: 'alpes-nord', dept: '73' },
  'HAUTE-TARENTAISE': { name: 'Haute-Tarentaise', zone: 'alpes-nord', dept: '73' },
  'VANOISE': { name: 'Vanoise', zone: 'alpes-nord', dept: '73' },
  'HAUTE-MAURIENNE': { name: 'Haute-Maurienne', zone: 'alpes-nord', dept: '73' },
  'MAURIENNE': { name: 'Maurienne', zone: 'alpes-nord', dept: '73' },
  'CHARTREUSE': { name: 'Chartreuse', zone: 'alpes-nord', dept: '38' },
  'BELLEDONNE': { name: 'Belledonne', zone: 'alpes-nord', dept: '38' },
  'GRANDES-ROUSSES': { name: 'Grandes-Rousses', zone: 'alpes-nord', dept: '38' },
  'VERCORS': { name: 'Vercors', zone: 'alpes-nord', dept: '38' },
  'OISANS': { name: 'Oisans', zone: 'alpes-nord', dept: '38' },
  // Alpes du Sud
  'THABOR': { name: 'Thabor', zone: 'alpes-sud', dept: '73' },
  'PELVOUX': { name: 'Pelvoux', zone: 'alpes-sud', dept: '05' },
  'QUEYRAS': { name: 'Queyras', zone: 'alpes-sud', dept: '05' },
  'DEVOLUY': { name: 'Dévoluy', zone: 'alpes-sud', dept: '05' },
  'CHAMPSAUR': { name: 'Champsaur', zone: 'alpes-sud', dept: '05' },
  'EMBRUNAIS-PARPAILLON': { name: 'Embrunais-Parpaillon', zone: 'alpes-sud', dept: '05' },
  'UBAYE': { name: 'Ubaye', zone: 'alpes-sud', dept: '04' },
  'HAUT-VAR-HAUT-VERDON': { name: 'Haut-Var Haut-Verdon', zone: 'alpes-sud', dept: '04' },
  'MERCANTOUR': { name: 'Mercantour', zone: 'alpes-sud', dept: '06' }
};

// Avalanche situation types with French labels
const SITUATIONS = {
  'neige_fraiche': 'Neige fraîche',
  'plaque_vent': 'Plaques à vent',
  'sous_couche_fragile': 'Sous-couche fragile persistante',
  'neige_humide': 'Neige humide',
  'glissement': 'Glissements de fond',
  'situation_favorable': 'Situation favorable'
};
