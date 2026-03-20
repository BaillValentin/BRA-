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

    return this;
  },

  // Get center point of a polygon feature
  getCenter(layer) {
    return layer.getBounds().getCenter();
  },

  renderMassifs(geojson, latestData) {
    this.latestData = latestData;
    var massifsRisks = latestData ? latestData.massifs : {};

    this.geojsonLayer = L.geoJSON(geojson, {
      style: function() {
        return {
          fillColor: 'transparent',
          fillOpacity: 0,
          weight: 2,
          color: '#555',
          opacity: 0.6
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

    // Place image markers at each massif center
    this.createImageMarkers(massifsRisks);
    this.setMode('risque');
  },

  createImageMarkers(massifsRisks) {
    for (var massifId in this.massifLayers) {
      var layer = this.massifLayers[massifId];
      var center = this.getCenter(layer);
      var data = massifsRisks[massifId] || {};

      // Create marker with a placeholder - will be updated by setMode
      var marker = L.marker(center, {
        icon: L.divIcon({
          className: 'massif-img-marker',
          html: '<div class="marker-img-container"></div>',
          iconSize: [70, 55],
          iconAnchor: [35, 27]
        })
      }).addTo(this.map);

      // Store data for later updates
      marker._massifId = massifId;
      marker._massifData = data;

      // Click opens panel
      marker.on('click', () => {
        this.selectMassif(massifId, layer);
        Panel.show(massifId);
      });

      // Tooltip
      var massifInfo = MASSIFS[massifId] || { name: massifId };
      marker.bindTooltip('<strong>' + massifInfo.name + '</strong>', {
        direction: 'top', offset: [0, -30]
      });

      this.imageMarkers[massifId] = marker;
    }
  },

  setMode(mode) {
    this.mode = mode;

    // Update toggle buttons
    document.querySelectorAll('.map-toggle-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update legend visibility
    var legend = document.getElementById('legend');
    legend.style.display = mode === 'risque' ? '' : 'none';

    // Update markers
    for (var massifId in this.imageMarkers) {
      var marker = this.imageMarkers[massifId];
      var data = marker._massifData;
      var imgs = data.img || {};

      var imgSrc = '';
      if (mode === 'risque' && imgs['montagne-risques']) {
        imgSrc = imgs['montagne-risques'];
      } else if (mode === 'enneigement' && imgs['montagne-enneigement']) {
        imgSrc = imgs['montagne-enneigement'];
      }

      if (imgSrc) {
        marker.setIcon(L.divIcon({
          className: 'massif-img-marker',
          html: '<img src="' + imgSrc + '" class="marker-img" alt="">',
          iconSize: [75, 60],
          iconAnchor: [37, 30]
        }));
        marker.setOpacity(1);
      } else {
        // Fallback: show risk number
        var risk = data.risk || '?';
        var color = RISK_COLORS[risk] || '#999';
        var textColor = RISK_TEXT_COLORS[risk] || '#FFF';
        marker.setIcon(L.divIcon({
          className: 'massif-img-marker',
          html: '<div class="marker-risk-badge" style="background:' + color + ';color:' + textColor + '">' + risk + '</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        }));
        marker.setOpacity(1);
      }
    }
  },

  selectMassif(massifId, layer) {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 2, color: '#555' });
    }
    layer.setStyle({ weight: 3, color: '#0066FF' });
    this.selectedLayer = layer;
  },

  deselectMassif() {
    if (this.selectedLayer) {
      this.selectedLayer.setStyle({ weight: 2, color: '#555' });
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
