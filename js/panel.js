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

    this.panelEl.querySelector('.panel-close').addEventListener('click', () => this.hide());

    document.getElementById('map').addEventListener('click', (e) => {
      if (this.isOpen && e.target.classList.contains('leaflet-container')) {
        this.hide();
      }
    });

    let startY = 0;
    const header = this.panelEl.querySelector('.panel-header');
    header.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; });
    header.addEventListener('touchmove', (e) => {
      if (e.touches[0].clientY - startY > 50) this.hide();
    });
  },

  async show(massifId) {
    const massifInfo = MASSIFS[massifId] || { name: massifId };
    this.titleEl.textContent = massifInfo.name;
    this.badgeEl.textContent = '...';
    this.badgeEl.style.backgroundColor = '#999';
    this.contentEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0;">Chargement du bulletin...</p>';
    this.panelEl.classList.add('open');
    this.isOpen = true;

    const data = await DataManager.loadMassifDetail(massifId);
    if (!data) {
      this.contentEl.innerHTML = '<p style="color:#FF3B30;padding:20px;">Impossible de charger le bulletin.</p>';
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

    // PDF embed
    if (data.pdfUrl) {
      html += `<div class="bra-pdf-container">
        <iframe src="${data.pdfUrl}" class="bra-pdf-iframe" title="BRA ${data.massif}"></iframe>
        <a href="${data.pdfUrl}" target="_blank" rel="noopener" class="bra-pdf-link">
          Ouvrir le PDF en plein écran ↗
        </a>
      </div>`;
    } else {
      // Fallback: show text data if no PDF URL
      html += this.renderTextFallback(data);
    }

    html += `<div class="bra-footer">Source : Météo-France</div>`;
    this.contentEl.innerHTML = html;
  },

  // Fallback text rendering if PDF not available
  renderTextFallback(data) {
    let html = '';

    // Risk summary
    if (data.summary) {
      html += `<div class="bra-card">
        <div class="bra-card-header">Estimation des risques</div>
        <div class="bra-card-body"><p>${data.summary.replace(/\n/g, '<br>')}</p></div>
      </div>`;
    }

    // Stability
    if (data.stability) {
      html += `<div class="bra-card">
        <div class="bra-card-header">Stabilité du manteau neigeux</div>
        <div class="bra-card-body"><p>${data.stability.replace(/\n/g, '<br>')}</p></div>
      </div>`;
    }

    // Snow quality
    if (data.snowQuality) {
      html += `<div class="bra-card">
        <div class="bra-card-header">Qualité de la neige</div>
        <div class="bra-card-body"><p>${data.snowQuality.replace(/\n/g, '<br>')}</p></div>
      </div>`;
    }

    return html;
  },

  hide() {
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
