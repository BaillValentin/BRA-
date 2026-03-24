document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const updateInfoEl = document.getElementById('update-info');
  const offlineBanner = document.getElementById('offline-banner');

  // Offline indicator — robust toggle
  function updateOnlineStatus() {
    if (navigator.onLine) {
      offlineBanner.classList.add('hidden');
      offlineBanner.setAttribute('aria-hidden', 'true');
    } else {
      offlineBanner.classList.remove('hidden');
      offlineBanner.setAttribute('aria-hidden', 'false');
    }
  }
  window.addEventListener('online', function() {
    // Small delay to ensure the event is stable
    setTimeout(updateOnlineStatus, 300);
  });
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  try {
    // Initialize map
    MapManager.init();
    Panel.init();

    // Load data in parallel
    const [geojson, latestData] = await Promise.all([
      DataManager.loadMassifBoundaries(),
      DataManager.loadLatestRisks()
    ]);

    if (geojson) {
      MapManager.renderMassifs(geojson, latestData);
    } else {
      console.error('Could not load massif boundaries');
    }

    // Show last update time
    const lastUpdate = DataManager.getLastUpdate();
    if (lastUpdate) {
      updateInfoEl.textContent = `Mis à jour : ${lastUpdate}`;
    }

    // Geolocation button
    document.getElementById('geolocate').addEventListener('click', () => {
      MapManager.geolocate();
    });

    // PDF overlay back button
    document.getElementById('pdf-back').addEventListener('click', () => {
      Panel.closePdf();
    });

    // Pre-cache all BRA images in background for offline use
    if (latestData && latestData.massifs) {
      setTimeout(() => {
        var allImgUrls = [];
        for (var mid in latestData.massifs) {
          var imgs = latestData.massifs[mid].img || {};
          for (var key in imgs) {
            allImgUrls.push(imgs[key]);
          }
        }
        // Fetch images quietly to populate SW cache
        allImgUrls.forEach(function(url) {
          var img = new Image();
          img.src = url;
        });
      }, 3000); // Delay to not block initial render
    }

  } catch (error) {
    console.error('App initialization error:', error);
  } finally {
    // Hide loading
    loadingEl.style.opacity = '0';
    setTimeout(() => { loadingEl.style.display = 'none'; }, 300);
  }

});
