const OfflineManager = {
  _panelOpen: false,

  openPanel() {
    var panel = document.getElementById('offline-panel');
    panel.classList.remove('hidden');
    this._panelOpen = true;
    this.renderMassifList();
    this.updateZoomInfo();

    // Zoom slider live update
    document.getElementById('offline-zoom').addEventListener('input', () => this.updateZoomInfo());

    // Show current cache status
    this.updateStatus();
  },

  closePanel() {
    document.getElementById('offline-panel').classList.add('hidden');
    this._panelOpen = false;
  },

  renderMassifList() {
    var container = document.getElementById('offline-massif-list');
    // Load saved selections
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem('offline-massifs') || '{}'); } catch (e) {}

    var html = '';
    var zones = { 'alpes-nord': 'Alpes du Nord', 'alpes-sud': 'Alpes du Sud' };

    for (var zone in zones) {
      html += '<div class="offline-zone-title">' + zones[zone] + '</div>';
      for (var id in MASSIFS) {
        if (MASSIFS[id].zone !== zone) continue;
        var checked = saved[id] ? ' checked' : '';
        var deleteBtn = saved[id]
          ? '<button class="offline-delete-btn" onclick="event.preventDefault();event.stopPropagation();OfflineManager.removeMassif(\'' + id + '\')" title="Supprimer du cache">&#10005;</button>'
          : '';
        html += '<label class="offline-massif-item">' +
          '<input type="checkbox" class="offline-massif-cb" data-massif="' + id + '"' + checked + '>' +
          '<span class="layer-check"></span>' +
          '<span class="offline-massif-name">' + MASSIFS[id].name + '</span>' +
          deleteBtn + '</label>';
      }
    }
    container.innerHTML = html;
  },

  selectAll() {
    document.querySelectorAll('.offline-massif-cb').forEach(function(cb) { cb.checked = true; });
  },

  selectNone() {
    document.querySelectorAll('.offline-massif-cb').forEach(function(cb) { cb.checked = false; });
  },

  getSelectedMassifs() {
    var selected = [];
    document.querySelectorAll('.offline-massif-cb:checked').forEach(function(cb) {
      selected.push(cb.dataset.massif);
    });
    return selected;
  },

  updateZoomInfo() {
    var zoom = parseInt(document.getElementById('offline-zoom').value);
    var tilesPerMassif = Math.round(Math.pow(4, zoom - 8) * 4);
    document.getElementById('offline-zoom-info').textContent =
      'Zoom ' + zoom + ' — estimation ~' + tilesPerMassif + ' tuiles/massif';
  },

  async download() {
    var selected = this.getSelectedMassifs();
    if (selected.length === 0) {
      alert('Sélectionnez au moins un massif.');
      return;
    }

    // Save selection
    var savedObj = {};
    selected.forEach(function(id) { savedObj[id] = true; });
    localStorage.setItem('offline-massifs', JSON.stringify(savedObj));

    var maxZoom = parseInt(document.getElementById('offline-zoom').value);
    var btn = document.getElementById('offline-download-btn');
    var progressEl = document.getElementById('offline-progress');
    var progressFill = document.getElementById('offline-progress-fill');
    var progressText = document.getElementById('offline-progress-text');

    btn.disabled = true;
    btn.textContent = 'Téléchargement en cours...';
    progressEl.classList.remove('hidden');

    try {
      // 1. Download BRA data for each massif
      var totalSteps = selected.length * 2; // data + images per massif
      var done = 0;

      for (var i = 0; i < selected.length; i++) {
        var massifId = selected[i];
        progressText.textContent = 'BRA ' + MASSIFS[massifId].name + '...';

        // Fetch massif JSON (will be cached by SW)
        try {
          await fetch(CONFIG.DATA_BASE_URL + massifId + '.json', { cache: 'reload' });
        } catch (e) {}
        // Fetch PDF
        try {
          await fetch(CONFIG.DATA_BASE_URL + massifId + '.pdf', { cache: 'reload' });
        } catch (e) {}

        done++;
        progressFill.style.width = Math.round(done / totalSteps * 50) + '%';

        // Fetch all images for this massif
        var detail = await DataManager.loadMassifDetail(massifId);
        if (detail && detail.imageUrls) {
          var imgUrls = Object.values(detail.imageUrls);
          for (var j = 0; j < imgUrls.length; j++) {
            try { await fetch(imgUrls[j]); } catch (e) {}
          }
        }
        done++;
        progressFill.style.width = Math.round(done / totalSteps * 50) + '%';
      }

      // 2. Download map tiles for each massif's bounding box
      progressText.textContent = 'Téléchargement des tuiles...';
      var allTileUrls = [];

      // Get bounding boxes from GeoJSON
      var geojson = await DataManager.loadMassifBoundaries();
      if (geojson) {
        for (var k = 0; k < selected.length; k++) {
          var mid = selected[k];
          var feature = null;
          for (var f = 0; f < geojson.features.length; f++) {
            if (geojson.features[f].properties.id === mid) {
              feature = geojson.features[f];
              break;
            }
          }
          if (!feature) continue;

          var bounds = this.getFeatureBounds(feature);
          // Generate tile URLs for zoom levels 8 to maxZoom
          for (var z = 8; z <= maxZoom; z++) {
            var tiles = this.getTilesForBounds(bounds, z);
            for (var t = 0; t < tiles.length; t++) {
              // OpenTopoMap tiles
              var tileUrl = CONFIG.TILE_URL
                .replace('{s}', ['a', 'b', 'c'][t % 3])
                .replace('{z}', z)
                .replace('{x}', tiles[t].x)
                .replace('{y}', tiles[t].y);
              allTileUrls.push(tileUrl);
            }
          }
        }
      }

      // Download tiles in batches of 6
      var tilesDone = 0;
      var totalTiles = allTileUrls.length;
      var batchSize = 6;

      for (var b = 0; b < allTileUrls.length; b += batchSize) {
        var batch = allTileUrls.slice(b, b + batchSize);
        await Promise.all(batch.map(function(url) {
          return fetch(url).catch(function() {});
        }));
        tilesDone += batch.length;
        var pct = 50 + Math.round(tilesDone / totalTiles * 50);
        progressFill.style.width = pct + '%';
        progressText.textContent = 'Tuiles : ' + tilesDone + '/' + totalTiles;
      }

      progressFill.style.width = '100%';
      progressText.textContent = 'Terminé ! ' + selected.length + ' massif(s), ' + totalTiles + ' tuiles.';
      this.updateStatus();

    } catch (e) {
      console.error('Offline download error:', e);
      progressText.textContent = 'Erreur : ' + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Télécharger pour hors-ligne';
    }
  },

  getFeatureBounds(feature) {
    var minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    var coords = feature.geometry.coordinates;

    function processCoords(arr) {
      if (typeof arr[0] === 'number') {
        // [lng, lat]
        if (arr[1] < minLat) minLat = arr[1];
        if (arr[1] > maxLat) maxLat = arr[1];
        if (arr[0] < minLng) minLng = arr[0];
        if (arr[0] > maxLng) maxLng = arr[0];
      } else {
        for (var i = 0; i < arr.length; i++) processCoords(arr[i]);
      }
    }
    processCoords(coords);

    // Add small padding
    var pad = 0.02;
    return { south: minLat - pad, north: maxLat + pad, west: minLng - pad, east: maxLng + pad };
  },

  getTilesForBounds(bounds, zoom) {
    var tiles = [];
    var minTile = this.latLngToTile(bounds.north, bounds.west, zoom);
    var maxTile = this.latLngToTile(bounds.south, bounds.east, zoom);

    for (var x = minTile.x; x <= maxTile.x; x++) {
      for (var y = minTile.y; y <= maxTile.y; y++) {
        tiles.push({ x: x, y: y });
      }
    }
    return tiles;
  },

  latLngToTile(lat, lng, zoom) {
    var n = Math.pow(2, zoom);
    var x = Math.floor((lng + 180) / 360 * n);
    var latRad = lat * Math.PI / 180;
    var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  },

  async removeMassif(massifId) {
    var name = MASSIFS[massifId] ? MASSIFS[massifId].name : massifId;
    if (!confirm('Supprimer les données hors-ligne de ' + name + ' ?')) return;

    var progressText = document.getElementById('offline-progress-text');
    var progressEl = document.getElementById('offline-progress');
    progressEl.classList.remove('hidden');
    progressText.textContent = 'Suppression de ' + name + '...';

    try {
      // Build list of URLs to delete for this massif
      var urlsToDelete = [];

      // BRA data + PDF
      urlsToDelete.push(CONFIG.DATA_BASE_URL + massifId + '.json');
      urlsToDelete.push(CONFIG.DATA_BASE_URL + massifId + '.pdf');

      // BRA images
      var detail = DataManager._cache[massifId];
      if (detail && detail.imageUrls) {
        var imgUrls = Object.values(detail.imageUrls);
        for (var i = 0; i < imgUrls.length; i++) {
          urlsToDelete.push(imgUrls[i]);
        }
      }

      // Delete from all caches
      var cacheNames = await caches.keys();
      for (var c = 0; c < cacheNames.length; c++) {
        var cache = await caches.open(cacheNames[c]);
        var keys = await cache.keys();
        for (var k = 0; k < keys.length; k++) {
          var reqUrl = keys[k].url;
          // Match BRA data/images by massif id
          for (var u = 0; u < urlsToDelete.length; u++) {
            if (reqUrl.includes(urlsToDelete[u])) {
              await cache.delete(keys[k]);
              break;
            }
          }
        }
      }

      // Delete tiles for this massif's bounding box
      var geojson = await DataManager.loadMassifBoundaries();
      if (geojson) {
        var feature = null;
        for (var f = 0; f < geojson.features.length; f++) {
          if (geojson.features[f].properties.id === massifId) {
            feature = geojson.features[f];
            break;
          }
        }
        if (feature) {
          var bounds = this.getFeatureBounds(feature);
          var tileCache = await caches.open('bra-tiles-v1');
          var tileKeys = await tileCache.keys();
          // Build set of tile coords for this massif (zoom 8-14)
          var massifTiles = {};
          for (var z = 8; z <= 14; z++) {
            var tiles = this.getTilesForBounds(bounds, z);
            for (var t = 0; t < tiles.length; t++) {
              massifTiles[z + '/' + tiles[t].x + '/' + tiles[t].y] = true;
            }
          }
          // Check each cached tile
          for (var tk = 0; tk < tileKeys.length; tk++) {
            var tileUrl = new URL(tileKeys[tk].url);
            // Extract z/x/y from path like /z/x/y.png
            var parts = tileUrl.pathname.split('/').filter(Boolean);
            if (parts.length >= 3) {
              var tileKey = parts[parts.length - 3] + '/' + parts[parts.length - 2] + '/' + parts[parts.length - 1].replace('.png', '');
              if (massifTiles[tileKey]) {
                await tileCache.delete(tileKeys[tk]);
              }
            }
          }
        }
      }

      // Remove from saved selection
      var saved = {};
      try { saved = JSON.parse(localStorage.getItem('offline-massifs') || '{}'); } catch (e) {}
      delete saved[massifId];
      localStorage.setItem('offline-massifs', JSON.stringify(saved));

      // Also clear from DataManager cache
      delete DataManager._cache[massifId];

      progressText.textContent = name + ' supprimé du cache.';
      this.renderMassifList();
      this.updateStatus();

    } catch (e) {
      console.error('Error removing massif cache:', e);
      progressText.textContent = 'Erreur lors de la suppression.';
    }
  },

  async purgeAll() {
    if (!confirm('Supprimer toutes les données hors-ligne ?')) return;

    var cacheNames = await caches.keys();
    for (var i = 0; i < cacheNames.length; i++) {
      if (cacheNames[i] !== 'bra-alpes-v29') { // Keep static assets
        await caches.delete(cacheNames[i]);
      }
    }
    localStorage.removeItem('offline-massifs');
    DataManager._cache = {};

    this.renderMassifList();
    this.updateStatus();
    document.getElementById('offline-progress-text').textContent = 'Tout le cache hors-ligne a été supprimé.';
    document.getElementById('offline-progress').classList.remove('hidden');
  },

  async updateStatus() {
    var statusEl = document.getElementById('offline-status');
    if (!statusEl) return;

    try {
      var saved = JSON.parse(localStorage.getItem('offline-massifs') || '{}');
      var names = [];
      for (var id in saved) {
        if (saved[id] && MASSIFS[id]) names.push(MASSIFS[id].name);
      }

      if (names.length > 0) {
        // Estimate cache size
        var cacheNames = await caches.keys();
        var totalSize = 0;
        for (var i = 0; i < cacheNames.length; i++) {
          var cache = await caches.open(cacheNames[i]);
          var keys = await cache.keys();
          totalSize += keys.length;
        }

        statusEl.innerHTML = '<strong>Massifs hors-ligne :</strong> ' + names.join(', ') +
          '<br><strong>Éléments en cache :</strong> ~' + totalSize;
      } else {
        statusEl.textContent = 'Aucun massif sauvegardé hors-ligne.';
      }
    } catch (e) {
      statusEl.textContent = '';
    }
  }
};
