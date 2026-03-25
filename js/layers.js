const LayerSelector = {
  isOpen: false,
  _ignTopoLayer: null,
  _otmLayer: null,
  _currentBase: 'otm',

  toggle() {
    this.isOpen = !this.isOpen;
    var dd = document.getElementById('layer-dropdown');
    dd.classList.toggle('hidden', !this.isOpen);
    document.querySelector('.layer-selector-btn').classList.toggle('active', this.isOpen);
  },

  close() {
    this.isOpen = false;
    document.getElementById('layer-dropdown').classList.add('hidden');
    document.querySelector('.layer-selector-btn').classList.remove('active');
  },

  update() {
    var useIGN = document.getElementById('layer-base-ign').checked;
    var risque = document.getElementById('layer-risque').checked;
    var enneigement = document.getElementById('layer-enneigement').checked;
    var pentes = document.getElementById('layer-pentes').checked;
    var refuges = document.getElementById('layer-refuges').checked;

    // ── Base map switch ──
    this.setBasemap(useIGN ? 'ign' : 'otm');

    // ── Marker mode ──
    if (risque) {
      MapManager.setMode('risque');
    } else if (enneigement) {
      MapManager.setMode('enneigement');
    } else {
      MapManager.setMode('none');
    }

    // ── Pentes overlay ──
    if (pentes) {
      if (!MapManager.slopeLayer) {
        MapManager.slopeLayer = L.tileLayer(CONFIG.SLOPES_URL, {
          attribution: CONFIG.SLOPES_ATTRIBUTION,
          maxZoom: CONFIG.MAX_ZOOM,
          opacity: 0.6
        });
      }
      if (!MapManager.map.hasLayer(MapManager.slopeLayer)) {
        MapManager.slopeLayer.addTo(MapManager.map);
      }
    } else if (MapManager.slopeLayer && MapManager.map.hasLayer(MapManager.slopeLayer)) {
      MapManager.map.removeLayer(MapManager.slopeLayer);
    }

    // Legends
    document.getElementById('slope-legend').style.display = pentes ? '' : 'none';
    document.getElementById('legend').style.display = risque ? '' : 'none';

    // Refuges
    if (refuges) {
      MapManager.showRefuges();
    } else {
      MapManager.hideRefuges();
    }
  },

  setBasemap(type) {
    if (type === this._currentBase) return;
    this._currentBase = type;

    // Remove current base layer
    if (this._otmLayer && MapManager.map.hasLayer(this._otmLayer)) {
      MapManager.map.removeLayer(this._otmLayer);
    }
    if (this._ignTopoLayer && MapManager.map.hasLayer(this._ignTopoLayer)) {
      MapManager.map.removeLayer(this._ignTopoLayer);
    }

    if (type === 'ign') {
      if (!this._ignTopoLayer) {
        this._ignTopoLayer = L.tileLayer(CONFIG.IGN_TOPO_URL, {
          attribution: CONFIG.IGN_TOPO_ATTRIBUTION,
          maxZoom: CONFIG.MAX_ZOOM
        });
      }
      this._ignTopoLayer.addTo(MapManager.map);
      // Send to back so overlays stay on top
      this._ignTopoLayer.bringToBack();
    } else {
      if (!this._otmLayer) {
        this._otmLayer = L.tileLayer(CONFIG.TILE_URL, {
          attribution: CONFIG.TILE_ATTRIBUTION,
          maxZoom: CONFIG.MAX_ZOOM,
          maxNativeZoom: 17
        });
      }
      this._otmLayer.addTo(MapManager.map);
      this._otmLayer.bringToBack();
    }
  },

  // Store reference to initial OTM layer created by MapManager
  setInitialBaseLayer(layer) {
    this._otmLayer = layer;
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (LayerSelector.isOpen && !e.target.closest('.layer-selector')) {
    LayerSelector.close();
  }
});
