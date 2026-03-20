const Panel = {
  panelEl: null,
  contentEl: null,
  titleEl: null,
  badgeEl: null,
  isOpen: false,

  init() {
    this.panelEl = document.getElementById('panel');
    this.contentEl = document.getElementById('panel-content');
    this.titleEl = document.getElementById('panel-title');
    this.badgeEl = document.getElementById('panel-risk-badge');

    // Close button
    this.panelEl.querySelector('.panel-close').addEventListener('click', () => this.hide());

    // Click outside panel closes it
    document.getElementById('map').addEventListener('click', (e) => {
      // Only close if clicking on the map itself, not on a massif polygon
      if (this.isOpen && e.target.classList.contains('leaflet-container')) {
        this.hide();
      }
    });

    // Swipe down to close on mobile
    let startY = 0;
    const header = this.panelEl.querySelector('.panel-header');
    header.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
    });
    header.addEventListener('touchmove', (e) => {
      const deltaY = e.touches[0].clientY - startY;
      if (deltaY > 50) {
        this.hide();
      }
    });
  },

  async show(massifId) {
    const massifInfo = MASSIFS[massifId] || { name: massifId };
    this.titleEl.textContent = massifInfo.name;
    this.badgeEl.textContent = '...';
    this.badgeEl.style.backgroundColor = '#999';
    this.contentEl.innerHTML = '<p style="text-align:center;color:#999;">Chargement...</p>';
    this.panelEl.classList.add('open');
    this.isOpen = true;

    const data = await DataManager.loadMassifDetail(massifId);
    if (!data) {
      this.contentEl.innerHTML = '<p style="color:#FF3B30;">Impossible de charger le bulletin.</p>';
      return;
    }

    this.renderBRA(data);
  },

  renderBRA(data) {
    const risk = data.riskMax || '?';
    const riskLabel = RISK_LABELS[risk] || 'Inconnu';
    const riskColor = RISK_COLORS[risk] || '#999';
    const textColor = RISK_TEXT_COLORS[risk] || '#FFF';

    this.badgeEl.textContent = `${risk} - ${riskLabel}`;
    this.badgeEl.style.backgroundColor = riskColor;
    this.badgeEl.style.color = textColor;

    let html = '';

    // Date
    if (data.date) {
      const dateStr = new Date(data.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      html += `<div class="bra-date">Bulletin du ${dateStr}</div>`;
    }

    // Risk by altitude
    if (data.risks && data.risks.length > 0) {
      html += `<div class="bra-section">
        <h3>Risque par altitude</h3>
        <table class="risk-table">
          <thead><tr><th>Altitude</th><th>Niveau</th><th>Orientations</th></tr></thead>
          <tbody>`;
      data.risks.forEach(r => {
        const color = RISK_COLORS[r.level] || '#999';
        const txtColor = RISK_TEXT_COLORS[r.level] || '#FFF';
        const orientations = r.orientations ? r.orientations.join(', ') : 'Toutes';
        html += `<tr>
          <td>${r.altitude}</td>
          <td><span class="risk-badge" style="background:${color};color:${txtColor}">${r.level}</span></td>
          <td>${orientations}</td>
        </tr>`;
      });
      html += `</tbody></table></div>`;
    }

    // Typical situations
    if (data.situations && data.situations.length > 0) {
      html += `<div class="bra-section"><h3>Situations avalancheuses typiques</h3><div class="situations-list">`;
      data.situations.forEach(s => {
        const label = SITUATIONS[s] || s;
        html += `<span class="situation-tag">${label}</span>`;
      });
      html += `</div></div>`;
    }

    // Summary
    if (data.summary) {
      html += `<div class="bra-section"><h3>R\u00e9sum\u00e9</h3><p>${data.summary}</p></div>`;
    }

    // Accidental risk
    if (data.accidental) {
      html += `<div class="bra-section"><h3>D\u00e9clenchements provoqu\u00e9s</h3><p>${data.accidental}</p></div>`;
    }

    // Natural risk
    if (data.natural) {
      html += `<div class="bra-section"><h3>D\u00e9parts spontan\u00e9s</h3><p>${data.natural}</p></div>`;
    }

    // Snow stability
    if (data.stability) {
      html += `<div class="bra-section"><h3>Stabilit\u00e9 du manteau neigeux</h3><p>${data.stability}</p></div>`;
    }

    // Snow quality
    if (data.snowQuality) {
      html += `<div class="bra-section"><h3>Qualit\u00e9 de la neige</h3><p>${data.snowQuality}</p></div>`;
    }

    this.contentEl.innerHTML = html;
  },

  hide() {
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
