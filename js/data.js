const DataManager = {
  _cache: {},
  _latestData: null,
  _geojson: null,

  async loadLatestRisks() {
    if (this._latestData) return this._latestData;
    try {
      const response = await fetch(CONFIG.DATA_BASE_URL + 'latest.json');
      if (!response.ok) throw new Error('Failed to load latest risks');
      this._latestData = await response.json();
      return this._latestData;
    } catch (error) {
      console.error('Error loading latest risks:', error);
      return null;
    }
  },

  async loadMassifDetail(massifId) {
    if (this._cache[massifId]) return this._cache[massifId];
    try {
      const response = await fetch(CONFIG.DATA_BASE_URL + massifId + '.json');
      if (!response.ok) throw new Error('Failed to load massif: ' + massifId);
      const data = await response.json();
      this._cache[massifId] = data;
      return data;
    } catch (error) {
      console.error('Error loading massif detail:', error);
      return null;
    }
  },

  async loadMassifBoundaries() {
    if (this._geojson) return this._geojson;
    try {
      const response = await fetch(CONFIG.GEOJSON_URL);
      if (!response.ok) throw new Error('Failed to load massif boundaries');
      this._geojson = await response.json();
      return this._geojson;
    } catch (error) {
      console.error('Error loading massif boundaries:', error);
      return null;
    }
  },

  getLastUpdate() {
    if (this._latestData && this._latestData.lastUpdate) {
      const date = new Date(this._latestData.lastUpdate);
      return date.toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }
    return null;
  }
};
