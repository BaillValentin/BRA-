const MapManager = {
  map: null,
  massifLayers: {},
  imageMarkers: {},
  selectedLayer: null,
  geojsonLayer: null,
  slopeLayer: null,
  latestData: null,
  mode: 'risque',

  init() {
    this.map = L.map('map', {
      center: CONFIG.MAP_CENTER,
      zoom: CONFIG.MAP_ZOOM,
      minZoom: CONFIG.MIN_ZOOM,
      maxZoom: CONFIG.MAX_ZOOM,
      zoomControl: true
    });

    var baseLayer = L.tileLayer(CONFIG.TILE_URL, {
      attribution: CONFIG.TILE_ATTRIBUTION,
      maxZoom: CONFIG.MAX_ZOOM
    }).addTo(this.map);

    // Pass base layer reference to LayerSelector for switching
    LayerSelector.setInitialBaseLayer(baseLayer);

    // Update marker sizes on zoom end only (avoid flickering during animation)
    this.map.on('zoomend', () => this.updateMarkerSizes());

    return this;
  },

  getCenter(layer) {
    // Use official center from GeoJSON properties if available
    var props = layer.feature && layer.feature.properties;
    if (props && props.lat_center && props.lon_center) {
      return L.latLng(props.lat_center, props.lon_center);
    }
    return layer.getBounds().getCenter();
  },

  // Get a size factor based on current zoom level
  getZoomScale() {
    var zoom = this.map.getZoom();
    // Échelle continue : 0.5 à z6, ~6.5 à z13
    return Math.pow(2, (zoom - 7) * 0.7);
  },

  // ── Risk pictogram SVG (diamond + exclamation marks) ──
  buildRiskSVG(risk, size) {
    var color = RISK_COLORS[risk] || '#999';
    var textColor = RISK_TEXT_COLORS[risk] || '#FFF';
    var s = size || 44;
    var h = s * 1.2;

    // Exclamation marks based on risk level
    var marks = '';
    var riskNum = parseInt(risk) || 0;
    if (riskNum >= 1 && riskNum <= 5) {
      var markCount = riskNum;
      var markY = h - 4;
      var spacing = s / (markCount + 1);
      for (var i = 0; i < markCount; i++) {
        var mx = spacing * (i + 1);
        marks += '<text x="' + mx + '" y="' + markY + '" text-anchor="middle" font-size="' + (s * 0.22) + '" font-weight="bold" fill="' + color + '">!</text>';
      }
    }

    return '<svg viewBox="0 0 ' + s + ' ' + h + '" width="' + s + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
      '<filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/></filter>' +
      '<g filter="url(#ds)">' +
      '<polygon points="' + (s/2) + ',2 ' + (s-3) + ',' + (h*0.42) + ' ' + (s/2) + ',' + (h*0.72) + ' 3,' + (h*0.42) + '" fill="' + color + '" stroke="#333" stroke-width="1.2"/>' +
      '<text x="' + (s/2) + '" y="' + (h*0.47) + '" text-anchor="middle" font-size="' + (s*0.36) + '" font-weight="bold" fill="' + textColor + '">' + risk + '</text>' +
      '</g>' +
      marks +
      '</svg>';
  },

  renderMassifs(geojson, latestData) {
    this.latestData = latestData;
    var massifsRisks = latestData ? latestData.massifs : {};

    this.geojsonLayer = L.geoJSON(geojson, {
      style: function(feature) {
        var massifId = feature.properties.id;
        var riskData = massifsRisks[massifId];
        var risk = riskData ? riskData.risk : 0;
        return {
          fillColor: RISK_COLORS[risk] || '#999',
          fillOpacity: 0.15,
          weight: 3,
          color: '#e74c3c',
          opacity: 0.8
        };
      },
      onEachFeature: (feature, layer) => {
        var massifId = feature.properties.id;
        this.massifLayers[massifId] = layer;
        layer.on('click', () => {
          if (this.compareMode) {
            this.handleCompareClick(massifId);
          } else {
            this.selectMassif(massifId, layer);
            Panel.show(massifId);
          }
        });
      }
    }).addTo(this.map);

    this.createMarkers(massifsRisks);
    this.createLabels();
    this.setMode('risque');
  },

  createMarkers(massifsRisks) {
    for (var massifId in this.massifLayers) {
      var layer = this.massifLayers[massifId];
      var center = this.getCenter(layer);
      var data = massifsRisks[massifId] || {};
      var massifInfo = MASSIFS[massifId] || { name: massifId };

      var marker = L.marker(center, {
        icon: L.divIcon({ className: 'massif-marker', html: '', iconSize: [1, 1] }),
        interactive: true
      }).addTo(this.map);

      marker._massifId = massifId;
      marker._massifData = data;

      marker.on('click', ((mid, lay) => {
        return () => {
          if (this.compareMode) { this.handleCompareClick(mid); }
          else { this.selectMassif(mid, lay); Panel.show(mid); }
        };
      })(massifId, layer));

      marker.bindTooltip('<strong>' + massifInfo.name + '</strong>', {
        direction: 'top', offset: [0, -25], className: 'massif-tooltip'
      });

      this.imageMarkers[massifId] = marker;
    }
  },

  createLabels() {
    this._labelMarkers = [];
    for (var massifId in this.massifLayers) {
      var layer = this.massifLayers[massifId];
      var center = this.getCenter(layer);
      var massifInfo = MASSIFS[massifId] || { name: massifId };

      // Offset label below the icon marker
      var labelPos = L.latLng(center.lat - 0.06, center.lng);

      var label = L.marker(labelPos, {
        icon: L.divIcon({
          className: 'massif-label',
          html: '<span>' + massifInfo.name + '</span>',
          iconSize: [100, 20],
          iconAnchor: [50, 0]
        }),
        interactive: false,
        zIndexOffset: -100
      }).addTo(this.map);

      this._labelMarkers.push(label);
    }
  },

  updateMarkerSizes() {
    this.setMode(this.mode);
  },

  setMode(mode) {
    this.mode = mode;

    var scale = this.getZoomScale();
    var massifsRisks = this.latestData ? this.latestData.massifs : {};

    // Update polygon fill
    if (this.geojsonLayer) {
      this.geojsonLayer.eachLayer(function(layer) {
        var massifId = layer.feature.properties.id;
        var riskData = massifsRisks[massifId];
        var risk = riskData ? riskData.risk : 0;
        if (mode === 'pentes') {
          layer.setStyle({ fillOpacity: 0, weight: 1, color: '#666', opacity: 0.4 });
        } else if (mode === 'risque') {
          layer.setStyle({ fillColor: RISK_COLORS[risk] || '#999', fillOpacity: 0.15, weight: 3, color: '#e74c3c' });
        } else {
          layer.setStyle({ fillColor: '#4A90D9', fillOpacity: 0.1, weight: 3, color: '#e74c3c' });
        }
      });
    }

    // Show/hide markers and labels based on mode
    var showMarkers = mode !== 'pentes';

    for (var massifId in this.imageMarkers) {
      var marker = this.imageMarkers[massifId];
      var data = marker._massifData;
      var imgs = data.img || {};

      if (!showMarkers) {
        marker.setIcon(L.divIcon({ className: 'massif-marker', html: '', iconSize: [0, 0] }));
        continue;
      }

      if (mode === 'risque') {
        var risk = data.risk || '?';
        var svgSize = Math.round(38 * scale);
        var svgH = Math.round(svgSize * 1.2);
        marker.setIcon(L.divIcon({
          className: 'massif-marker',
          html: this.buildRiskSVG(risk, svgSize),
          iconSize: [svgSize, svgH],
          iconAnchor: [svgSize / 2, svgH / 2]
        }));
      } else {
        // Enneigement: show small PNG thumbnail
        var imgSrc = imgs['montagne-enneigement'];
        if (imgSrc) {
          var imgW = Math.min(250, Math.round(15 * scale));
          var imgH = Math.min(200, Math.round(12 * scale));
          marker.setIcon(L.divIcon({
            className: 'massif-marker',
            html: '<img src="' + imgSrc + '" class="marker-enneigement" style="width:' + imgW + 'px">',
            iconSize: [imgW, imgH],
            iconAnchor: [imgW / 2, imgH / 2]
          }));
        } else {
          marker.setIcon(L.divIcon({
            className: 'massif-marker',
            html: '<div class="marker-snow-badge">❄</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          }));
        }
      }
    }

    // Show/hide labels
    if (this._labelMarkers) {
      for (var i = 0; i < this._labelMarkers.length; i++) {
        var lbl = this._labelMarkers[i];
        if (showMarkers) {
          if (!this.map.hasLayer(lbl)) lbl.addTo(this.map);
        } else {
          if (this.map.hasLayer(lbl)) this.map.removeLayer(lbl);
        }
      }
    }
  },

  selectMassif(massifId, layer) {
    if (this.selectedLayer) this.selectedLayer.setStyle({ weight: 3, color: '#e74c3c' });
    layer.setStyle({ weight: 4, color: '#0066FF' });
    this.selectedLayer = layer;
  },

  deselectMassif() {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 3, color: '#e74c3c' });
      this.selectedLayer = null;
    }
  },

  // ── Compare mode ──
  compareMode: false,
  compareSelection: [],

  toggleCompare() {
    if (this.compareMode) {
      this.cancelCompare();
    } else {
      this.compareMode = true;
      this.compareSelection = [];
      document.getElementById('compare-btn').classList.add('active');
      document.getElementById('compare-banner').classList.remove('hidden');
      document.getElementById('compare-text').textContent = 'Sélectionnez le 1er massif';
    }
  },

  cancelCompare() {
    this.compareMode = false;
    this.compareSelection = [];
    document.getElementById('compare-btn').classList.remove('active');
    document.getElementById('compare-banner').classList.add('hidden');
  },

  closeCompare() {
    document.getElementById('compare-panel').classList.add('hidden');
    this.cancelCompare();
  },

  handleCompareClick(massifId) {
    if (this.compareSelection.indexOf(massifId) !== -1) return; // already selected
    this.compareSelection.push(massifId);

    if (this.compareSelection.length === 1) {
      var name1 = (MASSIFS[massifId] || {}).name || massifId;
      document.getElementById('compare-text').textContent = name1 + ' ✓ — Sélectionnez le 2e massif';
    }

    if (this.compareSelection.length === 2) {
      document.getElementById('compare-banner').classList.add('hidden');
      this.showComparison(this.compareSelection[0], this.compareSelection[1]);
    }
  },

  async showComparison(id1, id2) {
    var panel = document.getElementById('compare-panel');
    var content = document.getElementById('compare-content');
    panel.classList.remove('hidden');
    content.innerHTML = '<p style="text-align:center;color:#999;padding:30px;">Chargement...</p>';

    var data1 = await DataManager.loadMassifDetail(id1);
    var data2 = await DataManager.loadMassifDetail(id2);

    if (!data1 || !data2) {
      content.innerHTML = '<p style="color:#FF3B30;padding:20px;">Données indisponibles.</p>';
      return;
    }

    var name1 = (MASSIFS[id1] || {}).name || id1;
    var name2 = (MASSIFS[id2] || {}).name || id2;
    var imgs1 = data1.imageUrls || {};
    var imgs2 = data2.imageUrls || {};

    var html = '';

    // Header with names
    html += '<div class="cmp-names"><div class="cmp-name">' + name1 + '</div><div class="cmp-vs">VS</div><div class="cmp-name">' + name2 + '</div></div>';

    // Risk comparison
    html += '<div class="cmp-section"><div class="cmp-section-title">Risque</div><div class="cmp-row">';
    html += this.buildCompareImg(imgs1['montagne-risques'], data1.riskMax);
    html += this.buildCompareImg(imgs2['montagne-risques'], data2.riskMax);
    html += '</div></div>';

    // Rose des pentes
    html += '<div class="cmp-section"><div class="cmp-section-title">Rose des pentes</div><div class="cmp-row">';
    html += this.buildCompareImg(imgs1['rose-pentes']);
    html += this.buildCompareImg(imgs2['rose-pentes']);
    html += '</div></div>';

    // Enneigement
    html += '<div class="cmp-section"><div class="cmp-section-title">Enneigement</div><div class="cmp-row">';
    html += this.buildCompareImg(imgs1['montagne-enneigement']);
    html += this.buildCompareImg(imgs2['montagne-enneigement']);
    html += '</div></div>';

    // Neige fraiche
    html += '<div class="cmp-section"><div class="cmp-section-title">Neige fraîche</div><div class="cmp-row">';
    html += this.buildCompareImg(imgs1['graphe-neige-fraiche']);
    html += this.buildCompareImg(imgs2['graphe-neige-fraiche']);
    html += '</div></div>';

    // Météo
    html += '<div class="cmp-section"><div class="cmp-section-title">Météo</div><div class="cmp-row">';
    html += this.buildCompareImg(imgs1['apercu-meteo']);
    html += this.buildCompareImg(imgs2['apercu-meteo']);
    html += '</div></div>';

    content.innerHTML = html;
  },

  buildCompareImg(src, risk) {
    if (src) {
      return '<div class="cmp-cell"><img src="' + src + '" class="cmp-img"></div>';
    }
    if (risk) {
      var color = RISK_COLORS[risk] || '#999';
      var tc = RISK_TEXT_COLORS[risk] || '#FFF';
      return '<div class="cmp-cell"><div class="cmp-risk-badge" style="background:' + color + ';color:' + tc + '">' + risk + '</div></div>';
    }
    return '<div class="cmp-cell"><span style="color:#ccc">—</span></div>';
  },

  // ── Refuges layer ──
  refugesVisible: false,
  _refugesLayer: null,
  _refugesData: null,

  async showRefuges() {
    this.refugesVisible = true;

    if (this._refugesLayer) {
      this._refugesLayer.addTo(this.map);
      return;
    }

    // Try localStorage cache first
    var cached = null;
    try {
      var raw = localStorage.getItem('refuges-cache');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.ts && Date.now() - parsed.ts < 7 * 24 * 3600 * 1000) {
          cached = parsed.data;
        }
      }
    } catch (e) {}

    if (cached) {
      this._buildRefugesLayer(cached);
      return;
    }

    // Fetch from Overpass API — Alpine huts + refuges in French Alps bbox
    var query = '[out:json][timeout:30];(' +
      'node["tourism"="alpine_hut"](43.5,4.5,46.5,7.8);' +
      'node["tourism"="wilderness_hut"](43.5,4.5,46.5,7.8);' +
      ');out body;';
    try {
      var resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      var json = await resp.json();
      var refuges = json.elements.map(function(el) {
        return {
          lat: el.lat, lon: el.lon,
          name: (el.tags && el.tags.name) || 'Refuge',
          ele: (el.tags && el.tags.ele) || null,
          capacity: (el.tags && el.tags.capacity) || null
        };
      });
      // Cache in localStorage
      try { localStorage.setItem('refuges-cache', JSON.stringify({ ts: Date.now(), data: refuges })); } catch (e) {}
      this._buildRefugesLayer(refuges);
    } catch (e) {
      console.error('Failed to load refuges:', e);
      this.refugesVisible = false;
    }
  },

  _buildRefugesLayer(refuges) {
    this._refugesData = refuges;
    this._refugesLayer = L.layerGroup();

    var refugeIcon = L.divIcon({
      className: 'refuge-marker',
      html: '<svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M12 3L2 13h3v7h14v-7h3L12 3z" fill="#8B4513" stroke="#FFF" stroke-width="1.5"/>' +
        '<rect x="10" y="14" width="4" height="6" fill="#FFF" rx="0.5"/></svg>',
      iconSize: [22, 22],
      iconAnchor: [11, 22]
    });

    for (var i = 0; i < refuges.length; i++) {
      var r = refuges[i];
      var tooltip = '<strong>' + r.name + '</strong>';
      if (r.ele) tooltip += '<br>' + r.ele + ' m';
      if (r.capacity) tooltip += '<br>Places : ' + r.capacity;

      L.marker([r.lat, r.lon], { icon: refugeIcon })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -18], className: 'refuge-tooltip' })
        .addTo(this._refugesLayer);
    }

    this._refugesLayer.addTo(this.map);
  },

  hideRefuges() {
    this.refugesVisible = false;
    if (this._refugesLayer && this.map.hasLayer(this._refugesLayer)) {
      this.map.removeLayer(this._refugesLayer);
    }
  },

  geolocate() {
    if (!navigator.geolocation) { alert('Géolocalisation non supportée.'); return; }
    var btn = document.getElementById('geolocate');
    btn.classList.add('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.map.setView([pos.coords.latitude, pos.coords.longitude], 11);
        if (this._userMarker) {
          this._userMarker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
        } else {
          this._userMarker = L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
            radius: 8, fillColor: '#4285F4', fillOpacity: 1, color: '#FFF', weight: 3
          }).addTo(this.map).bindTooltip('Ma position');
        }
        btn.classList.remove('locating');
      },
      () => { btn.classList.remove('locating'); alert('Position indisponible.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
};
