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
      if (this.isOpen && e.target.classList.contains('leaflet-container')) this.hide();
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
    this.contentEl.innerHTML = '<p style="text-align:center;color:#999;padding:40px 0;">Chargement...</p>';
    this.panelEl.classList.add('open');
    this.isOpen = true;

    const data = await DataManager.loadMassifDetail(massifId);
    if (!data) {
      this.contentEl.innerHTML = '<p style="color:#FF3B30;padding:20px;">Impossible de charger le bulletin.</p>';
      return;
    }
    this.renderBRA(data);
  },

  // ─── SVG COMPONENTS ───

  renderRiskFlag(level, size) {
    size = size || 60;
    const color = RISK_COLORS[level] || '#999';
    const textColor = RISK_TEXT_COLORS[level] || '#FFF';
    const h = size * 1.15;
    return '<svg viewBox="0 0 ' + size + ' ' + h + '" width="' + size + '" height="' + h + '">' +
      '<polygon points="' + size/2 + ',3 ' + (size-4) + ',' + h/2 + ' ' + size/2 + ',' + (h-3) + ' 4,' + h/2 + '" fill="' + color + '" stroke="#333" stroke-width="1.5"/>' +
      '<text x="' + size/2 + '" y="' + (h/2+6) + '" text-anchor="middle" font-size="' + size*0.38 + '" font-weight="bold" fill="' + textColor + '">' + level + '</text>' +
      '</svg>';
  },

  renderCompassRose(orientations) {
    var dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    var angles = [0, 45, 90, 135, 180, 225, 270, 315];
    var s = 130, cx = s/2, cy = s/2, r = s*0.38, ri = s*0.14;
    var sectors = '', labels = '';

    for (var i = 0; i < dirs.length; i++) {
      var active = orientations && orientations.indexOf(dirs[i]) !== -1;
      var a1 = (angles[i] - 22.5) * Math.PI / 180;
      var a2 = (angles[i] + 22.5) * Math.PI / 180;
      var x1 = (cx + r * Math.sin(a1)).toFixed(1);
      var y1 = (cy - r * Math.cos(a1)).toFixed(1);
      var x2 = (cx + r * Math.sin(a2)).toFixed(1);
      var y2 = (cy - r * Math.cos(a2)).toFixed(1);
      var xi1 = (cx + ri * Math.sin(a1)).toFixed(1);
      var yi1 = (cy - ri * Math.cos(a1)).toFixed(1);
      var xi2 = (cx + ri * Math.sin(a2)).toFixed(1);
      var yi2 = (cy - ri * Math.cos(a2)).toFixed(1);
      var fill = active ? '#1C1C1E' : '#E8E8E8';
      sectors += '<path d="M' + xi1 + ',' + yi1 + ' L' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 0,1 ' + x2 + ',' + y2 + ' L' + xi2 + ',' + yi2 + ' A' + ri + ',' + ri + ' 0 0,0 ' + xi1 + ',' + yi1 + '" fill="' + fill + '" stroke="#fff" stroke-width="1.5"/>';

      var lr = r + 12;
      var a = angles[i] * Math.PI / 180;
      var lx = (cx + lr * Math.sin(a)).toFixed(1);
      var ly = (cy - lr * Math.cos(a)).toFixed(1);
      labels += '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" dominant-baseline="central" font-size="' + (active ? 11 : 9) + '" font-weight="' + (active ? 'bold' : 'normal') + '" fill="' + (active ? '#1C1C1E' : '#aaa') + '">' + dirs[i] + '</text>';
    }

    return '<svg viewBox="-5 -5 140 140" width="140" height="140">' + sectors +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + ri + '" fill="white" stroke="#ddd" stroke-width="1"/>' +
      labels + '</svg>';
  },

  renderSituationIcon(situation) {
    var icons = {
      'neige_fraiche': '<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EBF5FB"/><line x1="25" y1="8" x2="25" y2="42" stroke="#4A90D9" stroke-width="2.5"/><line x1="8" y1="25" x2="42" y2="25" stroke="#4A90D9" stroke-width="2.5"/><line x1="13" y1="13" x2="37" y2="37" stroke="#4A90D9" stroke-width="2"/><line x1="37" y1="13" x2="13" y2="37" stroke="#4A90D9" stroke-width="2"/><circle cx="25" cy="25" r="3" fill="#4A90D9"/></svg>',
      'plaque_vent': '<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#FEF3E2"/><polygon points="10,40 25,10 40,40" fill="none" stroke="#E67E22" stroke-width="2.5"/><path d="M8,14 Q18,8 25,14 Q32,20 42,14" fill="none" stroke="#E67E22" stroke-width="2" opacity="0.7"/><path d="M10,20 Q20,14 27,20 Q34,26 42,20" fill="none" stroke="#E67E22" stroke-width="1.5" opacity="0.5"/></svg>',
      'sous_couche_fragile': '<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#F5EEF8"/><rect x="8" y="8" width="34" height="8" rx="2" fill="#8E44AD" opacity="0.5"/><rect x="8" y="34" width="34" height="8" rx="2" fill="#8E44AD" opacity="0.7"/><line x1="12" y1="20" x2="18" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="18" y1="20" x2="12" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="22" y1="20" x2="28" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="28" y1="20" x2="22" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="32" y1="20" x2="38" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="38" y1="20" x2="32" y2="28" stroke="#E74C3C" stroke-width="2"/></svg>',
      'neige_humide': '<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EBF5FB"/><polygon points="10,42 25,8 40,42" fill="none" stroke="#3498DB" stroke-width="2"/><circle cx="18" cy="18" r="5" fill="#F39C12" opacity="0.6"/><path d="M22,30 Q25,38 28,30" fill="none" stroke="#3498DB" stroke-width="2.5"/><path d="M15,36 Q18,42 21,36" fill="none" stroke="#3498DB" stroke-width="2" opacity="0.6"/></svg>',
      'glissement': '<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EAFAF1"/><polygon points="8,42 25,8 42,42" fill="none" stroke="#27AE60" stroke-width="2"/><path d="M14,35 C18,30 32,30 36,35" fill="none" stroke="#27AE60" stroke-width="2.5"/><line x1="14" y1="39" x2="36" y2="39" stroke="#27AE60" stroke-width="2"/><line x1="25" y1="22" x2="25" y2="28" stroke="#27AE60" stroke-width="2.5" stroke-linecap="round"/><path d="M21,26 L25,22 L29,26" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round"/></svg>'
    };
    return icons[situation] || '';
  },

  // ─── MAIN RENDER ───

  renderBRA(data) {
    var risk = data.riskMax || '?';
    var riskLabel = RISK_LABELS[risk] || 'Inconnu';
    var riskColor = RISK_COLORS[risk] || '#999';
    var textColor = RISK_TEXT_COLORS[risk] || '#FFF';

    this.badgeEl.textContent = risk + ' - ' + riskLabel;
    this.badgeEl.style.backgroundColor = riskColor;
    this.badgeEl.style.color = textColor;

    var html = '';

    // Date
    if (data.date) {
      var dateStr = new Date(data.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      var validStr = data.validUntil ? new Date(data.validUntil).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      }) : '';
      html += '<div class="bra-date">Bulletin du ' + dateStr + (validStr ? ' — Valable pour le ' + validStr : '') + '</div>';
    }

    // ── PDF button (top) ──
    if (data.pdfUrl) {
      html += '<button class="bra-pdf-link" onclick="Panel.showPdf(\'' + data.pdfUrl + '\')">Voir le BRA officiel (PDF)</button>';
    }

    // ── Section 1: Estimation des risques ──
    html += '<div class="bra-card">';
    html += '<div class="bra-card-header">Estimation des risques</div>';
    html += '<div class="bra-card-body">';

    var allOrientations = data.risks ? data.risks.reduce(function(acc, r) {
      return acc.concat(r.orientations || []);
    }, []) : [];
    var uniqueOrientations = allOrientations.filter(function(v, i, a) { return a.indexOf(v) === i; });

    html += '<div class="risk-overview">';
    html += '<div class="risk-flags">';
    if (data.risks && data.risks.length > 1) {
      for (var i = 0; i < data.risks.length; i++) {
        var r = data.risks[i];
        html += '<div class="risk-altitude-row">' +
          this.renderRiskFlag(r.level, 44) +
          '<span class="risk-alt-label">' + r.altitude + 'm</span></div>';
      }
    } else {
      html += this.renderRiskFlag(risk, 56);
    }
    html += '</div>';
    html += '<div class="risk-rose">' + this.renderCompassRose(uniqueOrientations) + '</div>';
    html += '</div>';

    if (data.summary) {
      html += '<div class="risk-summary">' + data.summary.replace(/\n/g, '<br>') + '</div>';
    }
    html += '</div></div>';

    // ── Section 2: Stabilité du manteau neigeux ──
    if (data.stability || data.situationText || (data.situations && data.situations.length > 0)) {
      html += '<div class="bra-card">';
      html += '<div class="bra-card-header">Stabilité du manteau neigeux</div>';
      html += '<div class="bra-card-body">';

      if (data.situations && data.situations.length > 0) {
        html += '<div class="situations-row"><span class="situations-label">Situation avalancheuse typique :</span><div class="situations-icons">';
        for (var j = 0; j < data.situations.length; j++) {
          var sit = data.situations[j];
          var label = SITUATIONS[sit] || sit;
          html += '<div class="situation-item">' + this.renderSituationIcon(sit) + '<span>' + label + '</span></div>';
        }
        html += '</div></div>';
      } else if (data.situationText) {
        html += '<p class="situation-text"><strong>Situation avalancheuse typique :</strong> ' + data.situationText + '</p>';
      }

      if (data.stability) {
        html += '<div class="stability-text">' + data.stability.replace(/\n/g, '<br>') + '</div>';
      }
      html += '</div></div>';
    }

    // ── Section 3: Qualité de la neige ──
    if (data.snowQuality) {
      html += '<div class="bra-card">';
      html += '<div class="bra-card-header">Qualité de la neige</div>';
      html += '<div class="bra-card-body"><p>' + data.snowQuality.replace(/\n/g, '<br>') + '</p></div>';
      html += '</div>';
    }

    // ── Footer ──
    html += '<div class="bra-footer">Source : Météo-France</div>';

    this.contentEl.innerHTML = html;
  },

  showPdf(pdfUrl) {
    // Save current content to restore later
    this._savedContent = this.contentEl.innerHTML;
    this.contentEl.innerHTML =
      '<div class="bra-pdf-view">' +
        '<button class="bra-pdf-back" onclick="Panel.hidePdf()">← Retour au bulletin</button>' +
        '<iframe src="' + pdfUrl + '" class="bra-pdf-iframe" title="BRA PDF"></iframe>' +
      '</div>';
  },

  hidePdf() {
    if (this._savedContent) {
      this.contentEl.innerHTML = this._savedContent;
      this._savedContent = null;
    }
  },

  hide() {
    this._savedContent = null;
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
