document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const updateInfoEl = document.getElementById('update-info');

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
      updateInfoEl.textContent = `Mis \u00e0 jour : ${lastUpdate}`;
    }

    // Geolocation button
    document.getElementById('geolocate').addEventListener('click', () => {
      MapManager.geolocate();
    });

    // PDF overlay back button
    document.getElementById('pdf-back').addEventListener('click', () => {
      Panel.closePdf();
    });

  } catch (error) {
    console.error('App initialization error:', error);
  } finally {
    // Hide loading
    loadingEl.style.opacity = '0';
    setTimeout(() => { loadingEl.style.display = 'none'; }, 300);
  }

});
