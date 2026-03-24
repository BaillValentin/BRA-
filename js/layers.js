const LayerSelector = {
  isOpen: false,

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
    var risque = document.getElementById('layer-risque').checked;
    var enneigement = document.getElementById('layer-enneigement').checked;
    var pentes = document.getElementById('layer-pentes').checked;
    var refuges = document.getElementById('layer-refuges').checked;

    // Determine marker mode: prioritize risque > enneigement, pentes is overlay
    if (risque) {
      MapManager.setMode('risque');
    } else if (enneigement) {
      MapManager.setMode('enneigement');
    } else {
      MapManager.setMode('risque'); // default fallback
    }

    // Pentes overlay
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

    // Pentes legend
    document.getElementById('slope-legend').style.display = pentes ? '' : 'none';
    // Risk legend
    document.getElementById('legend').style.display = risque ? '' : 'none';

    // Refuges
    if (refuges) {
      MapManager.showRefuges();
    } else {
      MapManager.hideRefuges();
    }
  }
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (LayerSelector.isOpen && !e.target.closest('.layer-selector')) {
    LayerSelector.close();
  }
});
