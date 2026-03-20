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
    this.contentEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0;">Chargement...</p>';
    this.panelEl.classList.add('open');
    this.isOpen = true;

    const data = await DataManager.loadMassifDetail(massifId);
    if (!data) {
      this.contentEl.innerHTML = '<p style="color:#FF3B30;padding:20px;">Bulletin indisponible.</p>';
      return;
    }
    this.renderBRA(data);
  },

  renderBRA(data) {
    var risk = data.riskMax || '?';
    var riskColor = RISK_COLORS[risk] || '#999';
    var textColor = RISK_TEXT_COLORS[risk] || '#FFF';
    var riskLabel = RISK_LABELS[risk] || 'Inconnu';
    this.badgeEl.textContent = risk + ' - ' + riskLabel;
    this.badgeEl.style.backgroundColor = riskColor;
    this.badgeEl.style.color = textColor;

    var imgs = data.imageUrls || {};
    var html = '';

    // Date
    if (data.date) {
      var d = new Date(data.date);
      html += '<div class="bra-date">Bulletin du ' + d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }) + '</div>';
    }

    // PDF button
    if (data.pdfUrl) {
      html += '<button class="bra-pdf-btn" onclick="Panel.openPdf(\'' + data.pdfUrl + '\')">Voir le BRA officiel (PDF)</button>';
    }

    // ── Estimation des risques ──
    html += '<div class="bra-card"><div class="bra-card-header">Estimation des risques</div><div class="bra-card-body">';
    if (imgs['montagne-risques'] || imgs['rose-pentes']) {
      html += '<div class="bra-img-row">';
      if (imgs['montagne-risques']) html += '<img src="' + imgs['montagne-risques'] + '" class="bra-img-half" alt="Risques">';
      if (imgs['rose-pentes']) html += '<img src="' + imgs['rose-pentes'] + '" class="bra-img-half" alt="Pentes">';
      html += '</div>';
    }
    if (data.summary) html += '<p class="bra-text">' + data.summary.replace(/\n/g, '<br>') + '</p>';
    html += '</div></div>';

    // ── Stabilité ──
    if (data.stability) {
      html += '<div class="bra-card"><div class="bra-card-header">Stabilité du manteau neigeux</div>';
      html += '<div class="bra-card-body"><p class="bra-text">' + data.stability.replace(/\n/g, '<br>') + '</p></div></div>';
    }

    // ── Enneigement ──
    if (data.snowQuality || imgs['montagne-enneigement']) {
      html += '<div class="bra-card"><div class="bra-card-header">Qualité de la neige</div><div class="bra-card-body">';
      if (imgs['montagne-enneigement']) html += '<img src="' + imgs['montagne-enneigement'] + '" class="bra-img-full" alt="Enneigement">';
      if (data.snowQuality) html += '<p class="bra-text">' + data.snowQuality.replace(/\n/g, '<br>') + '</p>';
      html += '</div></div>';
    }

    // ── Neige fraîche ──
    if (imgs['graphe-neige-fraiche']) {
      html += '<div class="bra-card"><div class="bra-card-header">Neige fraîche</div><div class="bra-card-body">';
      html += '<img src="' + imgs['graphe-neige-fraiche'] + '" class="bra-img-full" alt="Neige fraîche">';
      html += '</div></div>';
    }

    // ── Météo ──
    if (imgs['apercu-meteo']) {
      html += '<div class="bra-card"><div class="bra-card-header">Aperçu météo</div><div class="bra-card-body">';
      html += '<img src="' + imgs['apercu-meteo'] + '" class="bra-img-full" alt="Météo">';
      html += '</div></div>';
    }

    // ── 7 derniers jours ──
    if (imgs['sept-derniers-jours']) {
      html += '<div class="bra-card"><div class="bra-card-header">7 derniers jours</div><div class="bra-card-body">';
      html += '<img src="' + imgs['sept-derniers-jours'] + '" class="bra-img-full" alt="7 derniers jours">';
      html += '</div></div>';
    }

    html += '<div class="bra-footer">Source : Météo-France</div>';
    this.contentEl.innerHTML = html;
  },

  openPdf(url) {
    var overlay = document.getElementById('pdf-overlay');
    var frame = document.getElementById('pdf-frame');
    var absoluteUrl = new URL(url, window.location.href).href;
    frame.src = 'https://mozilla.github.io/pdf.js/web/viewer.html?file=' + encodeURIComponent(absoluteUrl);
    overlay.classList.remove('hidden');
  },

  closePdf() {
    var overlay = document.getElementById('pdf-overlay');
    document.getElementById('pdf-frame').src = '';
    overlay.classList.add('hidden');
  },

  hide() {
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
