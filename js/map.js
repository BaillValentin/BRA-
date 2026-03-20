const MapManager = {
  map: null,
  massifLayers: {},
  imageMarkers: {},
  selectedLayer: null,
  geojsonLayer: null,
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

    L.tileLayer(CONFIG.TILE_URL, {
      attribution: CONFIG.TILE_ATTRIBUTION,
      maxZoom: CONFIG.MAX_ZOOM
    }).addTo(this.map);

    // Update marker sizes on zoom
    this.map.on('zoomend', () => this.updateMarkerSizes());

    return this;
  },

  getCenter(layer) {
    return layer.getBounds().getCenter();
  },

  // Get a size factor based on current zoom level
  getZoomScale() {
    var zoom = this.map.getZoom();
    if (zoom <= 7) return 0.6;
    if (zoom <= 8) return 0.8;
    if (zoom <= 9) return 1.0;
    if (zoom <= 10) return 1.3;
    return 1.6;
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
          fillOpacity: 0.2,
          weight: 2.5,
          color: '#2c3e50',
          opacity: 0.7,
          dashArray: ''
        };
      },
      onEachFeature: (feature, layer) => {
        var massifId = feature.properties.id;
        this.massifLayers[massifId] = layer;
        layer.on('click', () => {
          this.selectMassif(massifId, layer);
          Panel.show(massifId);
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
        return () => { this.selectMassif(mid, lay); Panel.show(mid); };
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
      var labelPos = L.latLng(center.lat - 0.04, center.lng);

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

    document.querySelectorAll('.map-toggle-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Legend
    document.getElementById('legend').style.display = mode === 'risque' ? '' : 'none';

    var scale = this.getZoomScale();
    var massifsRisks = this.latestData ? this.latestData.massifs : {};

    // Update polygon fill
    if (this.geojsonLayer) {
      this.geojsonLayer.eachLayer(function(layer) {
        var massifId = layer.feature.properties.id;
        var riskData = massifsRisks[massifId];
        var risk = riskData ? riskData.risk : 0;
        if (mode === 'risque') {
          layer.setStyle({ fillColor: RISK_COLORS[risk] || '#999', fillOpacity: 0.2, weight: 2.5, color: '#2c3e50' });
        } else {
          layer.setStyle({ fillColor: '#4A90D9', fillOpacity: 0.12, weight: 2.5, color: '#2c3e50' });
        }
      });
    }

    // Update markers
    for (var massifId in this.imageMarkers) {
      var marker = this.imageMarkers[massifId];
      var data = marker._massifData;
      var imgs = data.img || {};

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
          var imgW = Math.max(80, Math.round(60 * scale));
          var imgH = Math.max(64, Math.round(48 * scale));
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
  },

  selectMassif(massifId, layer) {
    if (this.selectedLayer) this.selectedLayer.setStyle({ weight: 1.5, color: '#666' });
    layer.setStyle({ weight: 3, color: '#0066FF' });
    this.selectedLayer = layer;
  },

  deselectMassif() {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 1.5, color: '#666' });
      this.selectedLayer = null;
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
