const MapManager = {
  map: null,
  massifLayers: {},
  selectedLayer: null,

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

    // Move zoom control to top-left (default) - already there
    return this;
  },

  renderMassifs(geojson, latestData) {
    const massifsRisks = latestData ? latestData.massifs : {};

    L.geoJSON(geojson, {
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

        // Store layer reference
        this.massifLayers[massifId] = layer;

        // Tooltip on hover
        layer.bindTooltip(
          `<strong>${massifInfo.name}</strong><br>Risque: ${risk} - ${label}`,
          { sticky: true, className: 'massif-tooltip' }
        );

        // Click handler
        layer.on('click', () => {
          this.selectMassif(massifId, layer);
          Panel.show(massifId);
        });
      }
    }).addTo(this.map);
  },

  selectMassif(massifId, layer) {
    // Reset previous selection
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 2, color: '#333333' });
    }
    // Highlight new selection
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
      alert('La g\u00e9olocalisation n\'est pas support\u00e9e par votre navigateur.');
      return;
    }
    const btn = document.getElementById('geolocate');
    btn.classList.add('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.map.setView([latitude, longitude], 11);

        // Add/update marker for user position
        if (this._userMarker) {
          this._userMarker.setLatLng([latitude, longitude]);
        } else {
          this._userMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            color: '#FFFFFF',
            weight: 3
          }).addTo(this.map).bindTooltip('Ma position');
        }
        btn.classList.remove('locating');
      },
      (error) => {
        btn.classList.remove('locating');
        alert('Impossible d\'obtenir votre position.');
        console.error('Geolocation error:', error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
};
