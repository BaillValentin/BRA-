const MapManager = {
  map: null,
  massifLayers: {},
  selectedLayer: null,
  geojsonLayer: null,
  latestData: null,
  mode: 'risque', // 'risque' or 'enneigement'

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

    return this;
  },

  renderMassifs(geojson, latestData) {
    this.latestData = latestData;
    const massifsRisks = latestData ? latestData.massifs : {};

    this.geojsonLayer = L.geoJSON(geojson, {
      style: (feature) => {
        const massifId = feature.properties.id;
        const riskData = massifsRisks[massifId];
        const risk = riskData ? riskData.risk : 0;
        return {
          fillColor: RISK_COLORS[risk] || '#999999',
          fillOpacity: 0.5,
          weight: 2,
          color: '#333333',
          opacity: 0.8
        };
      },
      onEachFeature: (feature, layer) => {
        const massifId = feature.properties.id;
        const massifInfo = MASSIFS[massifId] || { name: massifId };
        const riskData = massifsRisks[massifId];
        const risk = riskData ? riskData.risk : '?';
        const label = RISK_LABELS[risk] || 'Inconnu';

        this.massifLayers[massifId] = layer;

        layer.bindTooltip(
          '<strong>' + massifInfo.name + '</strong><br>Risque: ' + risk + ' - ' + label,
          { sticky: true, className: 'massif-tooltip' }
        );

        layer.on('click', () => {
          this.selectMassif(massifId, layer);
          Panel.show(massifId);
        });
      }
    }).addTo(this.map);
  },

  setMode(mode) {
    this.mode = mode;
    // Update toggle UI
    document.querySelectorAll('.map-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    // Update polygon styles
    if (!this.geojsonLayer || !this.latestData) return;
    const massifsRisks = this.latestData.massifs;

    this.geojsonLayer.eachLayer(layer => {
      const massifId = layer.feature.properties.id;
      const massifInfo = MASSIFS[massifId] || { name: massifId };
      const riskData = massifsRisks[massifId];
      const risk = riskData ? riskData.risk : 0;

      if (mode === 'risque') {
        layer.setStyle({
          fillColor: RISK_COLORS[risk] || '#999',
          fillOpacity: 0.5
        });
        layer.setTooltipContent(
          '<strong>' + massifInfo.name + '</strong><br>Risque: ' + risk + ' - ' + (RISK_LABELS[risk] || '?')
        );
      } else {
        // Enneigement mode — neutral blue tones
        layer.setStyle({
          fillColor: '#4A90D9',
          fillOpacity: 0.35
        });
        layer.setTooltipContent(
          '<strong>' + massifInfo.name + '</strong><br>Voir enneigement'
        );
      }
    });
  },

  selectMassif(massifId, layer) {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 2, color: '#333333' });
    }
    layer.setStyle({ weight: 4, color: '#0066FF' });
    this.selectedLayer = layer;
  },

  deselectMassif() {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 2, color: '#333333' });
      this.selectedLayer = null;
    }
  },

  geolocate() {
    if (!navigator.geolocation) {
      alert('Géolocalisation non supportée.');
      return;
    }
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
