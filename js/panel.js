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

    // Date + validity
    if (data.date) {
      var d = new Date(data.date);
      var dateStr = d.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      html += '<div class="bra-date">Bulletin du ' + dateStr;
      if (data.validUntil) {
        var v = new Date(data.validUntil);
        html += ' — valable jusqu\'au ' + v.toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long'
        }) + ' à ' + v.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      html += '</div>';
    }

    // PDF button
    if (data.pdfUrl) {
      html += '<button class="bra-pdf-btn" onclick="Panel.openPdf(\'' + data.pdfUrl + '\')">Voir le BRA officiel (PDF)</button>';
    }

    // ── Situations ──
    if (data.situations && data.situations.length > 0) {
      html += '<div class="bra-card"><div class="bra-card-header">Situations typiques</div><div class="bra-card-body">';
      html += '<div class="situations-list">';
      for (var j = 0; j < data.situations.length; j++) {
        var sit = data.situations[j];
        var label = SITUATIONS[sit] || sit;
        var icon = this.getSituationIcon(sit);
        html += '<span class="situation-tag">' + icon + ' ' + label + '</span>';
      }
      html += '</div></div></div>';
    }

    // ── Estimation des risques (images) ──
    html += this.buildCollapsible('Estimation des risques', function() {
      var inner = '';
      if (imgs['montagne-risques'] || imgs['rose-pentes']) {
        inner += '<div class="bra-img-row">';
        if (imgs['montagne-risques']) inner += '<img src="' + imgs['montagne-risques'] + '" class="bra-img-half" alt="Risques">';
        if (imgs['rose-pentes']) inner += '<img src="' + imgs['rose-pentes'] + '" class="bra-img-half" alt="Pentes">';
        inner += '</div>';
      }
      if (data.summary) inner += '<p class="bra-text">' + data.summary.replace(/\n/g, '<br>') + '</p>';
      return inner;
    }(), true);

    // ── Stabilité ──
    if (data.stability) {
      html += this.buildCollapsible('Stabilité du manteau neigeux', '<p class="bra-text">' + data.stability.replace(/\n/g, '<br>') + '</p>', false);
    }

    // ── Enneigement ──
    if (data.snowQuality || imgs['montagne-enneigement']) {
      var snowHtml = '';
      if (imgs['montagne-enneigement']) snowHtml += '<img src="' + imgs['montagne-enneigement'] + '" class="bra-img-full" alt="Enneigement">';
      if (data.snowQuality) snowHtml += '<p class="bra-text">' + data.snowQuality.replace(/\n/g, '<br>') + '</p>';
      html += this.buildCollapsible('Qualité de la neige', snowHtml, true);
    }

    // ── Neige fraîche ──
    if (imgs['graphe-neige-fraiche']) {
      html += this.buildCollapsible('Neige fraîche',
        '<img src="' + imgs['graphe-neige-fraiche'] + '" class="bra-img-full" alt="Neige fraîche">', true);
    }

    // ── Météo ──
    if (imgs['apercu-meteo']) {
      html += this.buildCollapsible('Aperçu météo',
        '<img src="' + imgs['apercu-meteo'] + '" class="bra-img-full" alt="Météo">', false);
    }

    // ── 7 derniers jours ──
    if (imgs['sept-derniers-jours']) {
      html += this.buildCollapsible('7 derniers jours',
        '<img src="' + imgs['sept-derniers-jours'] + '" class="bra-img-full" alt="7 derniers jours">', false);
    }

    html += '<div class="bra-footer">Source : Météo-France</div>';
    this.contentEl.innerHTML = html;
  },

  buildCollapsible(title, content, openByDefault) {
    var openAttr = openByDefault ? ' open' : '';
    return '<details class="bra-card bra-collapsible"' + openAttr + '>' +
      '<summary class="bra-card-header">' + title + '<span class="collapse-arrow"></span></summary>' +
      '<div class="bra-card-body">' + content + '</div></details>';
  },

  getSituationIcon(sit) {
    var icons = {
      'neige_fraiche': '&#10052;',
      'plaque_vent': '&#9888;',
      'sous_couche_fragile': '&#9878;',
      'neige_humide': '&#9748;',
      'glissement': '&#8595;',
      'situation_favorable': '&#10004;'
    };
    return icons[sit] || '';
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
