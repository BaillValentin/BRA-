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

  renderRiskFlag(level, size = 60) {
    const color = RISK_COLORS[level] || '#999';
    const textColor = RISK_TEXT_COLORS[level] || '#FFF';
    const h = size * 1.15;
    return `<svg viewBox="0 0 ${size} ${h}" width="${size}" height="${h}">
      <polygon points="${size/2},3 ${size-4},${h/2} ${size/2},${h-3} 4,${h/2}" fill="${color}" stroke="#333" stroke-width="1.5"/>
      <text x="${size/2}" y="${h/2+6}" text-anchor="middle" font-size="${size*0.38}" font-weight="bold" fill="${textColor}">${level}</text>
    </svg>`;
  },

  renderCompassRose(orientations, size = 130) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const cx = size/2, cy = size/2, r = size*0.38, rInner = size*0.14;

    let sectors = '';
    dirs.forEach((dir, i) => {
      const active = orientations && orientations.includes(dir);
      const a1 = (angles[i] - 22.5) * Math.PI / 180;
      const a2 = (angles[i] + 22.5) * Math.PI / 180;
      const x1 = cx + r * Math.sin(a1), y1 = cy - r * Math.cos(a1);
      const x2 = cx + r * Math.sin(a2), y2 = cy - r * Math.cos(a2);
      const xi1 = cx + rInner * Math.sin(a1), yi1 = cy - rInner * Math.cos(a1);
      const xi2 = cx + rInner * Math.sin(a2), yi2 = cy - rInner * Math.cos(a2);
      const fill = active ? '#1C1C1E' : '#E8E8E8';
      sectors += `<path d="M${xi1.toFixed(1)},${yi1.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${rInner},${rInner} 0 0,0 ${xi1.toFixed(1)},${yi1.toFixed(1)}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
    });

    const labelR = r + 12;
    let labels = '';
    dirs.forEach((dir, i) => {
      const a = angles[i] * Math.PI / 180;
      const x = cx + labelR * Math.sin(a), y = cy - labelR * Math.cos(a);
      const active = orientations && orientations.includes(dir);
      labels += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${active ? 11 : 9}" font-weight="${active ? 'bold' : 'normal'}" fill="${active ? '#1C1C1E' : '#aaa'}">${dir}</text>`;
    });

    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${sectors}
      <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="white" stroke="#ddd" stroke-width="1"/>
      ${labels}
    </svg>`;
  },

  renderSituationIcon(situation) {
    const icons = {
      'neige_fraiche': `<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EBF5FB"/><line x1="25" y1="8" x2="25" y2="42" stroke="#4A90D9" stroke-width="2.5"/><line x1="8" y1="25" x2="42" y2="25" stroke="#4A90D9" stroke-width="2.5"/><line x1="13" y1="13" x2="37" y2="37" stroke="#4A90D9" stroke-width="2"/><line x1="37" y1="13" x2="13" y2="37" stroke="#4A90D9" stroke-width="2"/><circle cx="25" cy="25" r="3" fill="#4A90D9"/></svg>`,
      'plaque_vent': `<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#FEF3E2"/><polygon points="10,40 25,10 40,40" fill="none" stroke="#E67E22" stroke-width="2.5"/><path d="M8,14 Q18,8 25,14 Q32,20 42,14" fill="none" stroke="#E67E22" stroke-width="2" opacity="0.7"/><path d="M10,20 Q20,14 27,20 Q34,26 42,20" fill="none" stroke="#E67E22" stroke-width="1.5" opacity="0.5"/></svg>`,
      'sous_couche_fragile': `<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#F5EEF8"/><rect x="8" y="8" width="34" height="8" rx="2" fill="#8E44AD" opacity="0.5"/><rect x="8" y="34" width="34" height="8" rx="2" fill="#8E44AD" opacity="0.7"/><line x1="12" y1="20" x2="18" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="18" y1="20" x2="12" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="22" y1="20" x2="28" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="28" y1="20" x2="22" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="32" y1="20" x2="38" y2="28" stroke="#E74C3C" stroke-width="2"/><line x1="38" y1="20" x2="32" y2="28" stroke="#E74C3C" stroke-width="2"/></svg>`,
      'neige_humide': `<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EBF5FB"/><polygon points="10,42 25,8 40,42" fill="none" stroke="#3498DB" stroke-width="2"/><circle cx="18" cy="18" r="5" fill="#F39C12" opacity="0.6"/><path d="M22,30 Q25,38 28,30" fill="none" stroke="#3498DB" stroke-width="2.5"/><path d="M15,36 Q18,42 21,36" fill="none" stroke="#3498DB" stroke-width="2" opacity="0.6"/></svg>`,
      'glissement': `<svg viewBox="0 0 50 50" width="44" height="44"><rect width="50" height="50" rx="8" fill="#EAFAF1"/><polygon points="8,42 25,8 42,42" fill="none" stroke="#27AE60" stroke-width="2"/><path d="M14,35 C18,30 32,30 36,35" fill="none" stroke="#27AE60" stroke-width="2.5"/><line x1="14" y1="39" x2="36" y2="39" stroke="#27AE60" stroke-width="2"/><line x1="25" y1="22" x2="25" y2="28" stroke="#27AE60" stroke-width="2.5" stroke-linecap="round"/><path d="M21,26 L25,22 L29,26" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round"/></svg>`
    };
    return icons[situation] || '';
  },

  // ─── SNOW DEPTH DIAGRAM (like the BRA mountain profile) ───

  renderSnowDepthDiagram(enneigement) {
    if (!enneigement || !enneigement.niveaux || enneigement.niveaux.length === 0) return '';

    const niveaux = enneigement.niveaux;
    const w = 280, h = 180, padL = 55, padR = 55, padT = 15, padB = 25;
    const chartW = w - padL - padR, chartH = h - padT - padB;

    // Get altitude range
    const altitudes = niveaux.map(n => parseInt(n.altitude)).filter(a => !isNaN(a));
    if (altitudes.length === 0) return '';
    const minAlt = Math.min(...altitudes), maxAlt = Math.max(...altitudes);
    const altRange = maxAlt - minAlt || 1;

    const yForAlt = (alt) => padT + chartH - ((alt - minAlt) / altRange) * chartH;

    // Mountain shape
    const peakX = padL + chartW / 2;
    let mountainPath = `M${padL},${h - padB}`;

    // Build left side (Nord) and right side (Sud) with snow depths
    let nordLabels = '', sudLabels = '';

    niveaux.forEach(n => {
      const alt = parseInt(n.altitude);
      const nord = parseInt(n.nord) || 0;
      const sud = parseInt(n.sud) || 0;
      const y = yForAlt(alt);

      // Nord labels (left)
      if (nord > 0) {
        nordLabels += `<text x="${padL - 5}" y="${y}" text-anchor="end" font-size="10" fill="#2196F3" font-weight="bold">${nord} cm</text>`;
      }
      // Sud labels (right)
      if (sud > 0) {
        sudLabels += `<text x="${w - padR + 5}" y="${y}" text-anchor="start" font-size="10" fill="#F44336" font-weight="bold">${sud} cm</text>`;
      }
      // Altitude labels
      nordLabels += `<text x="${peakX}" y="${y - 2}" text-anchor="middle" font-size="8" fill="#666">${alt} m</text>`;
      // Dashed line
      nordLabels += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#ddd" stroke-width="0.5" stroke-dasharray="3,3"/>`;
    });

    // Mountain shape
    const mountain = `<polygon points="${padL},${h-padB} ${peakX},${padT+10} ${w-padR},${h-padB}" fill="#E8E8E8" stroke="#999" stroke-width="1.5"/>`;

    // Labels
    const header = `<text x="${padL}" y="${h-5}" text-anchor="start" font-size="10" fill="#2196F3" font-weight="bold">Nord</text>
    <text x="${w-padR}" y="${h-5}" text-anchor="end" font-size="10" fill="#F44336" font-weight="bold">Sud</text>`;

    return `<div class="bra-section">
      <h3>Épaisseur de neige hors piste</h3>
      <div class="snow-diagram">
        <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px">
          ${mountain}
          ${nordLabels}
          ${sudLabels}
          ${header}
        </svg>
      </div>
    </div>`;
  },

  // ─── FRESH SNOW BAR CHART ───

  renderFreshSnowChart(neigeFraiche) {
    if (!neigeFraiche || neigeFraiche.length === 0) return '';

    const w = 280, h = 120, padL = 40, padR = 10, padT = 15, padB = 30;
    const chartW = w - padL - padR, chartH = h - padT - padB;

    const quantities = neigeFraiche.map(n => parseInt(n.quantite) || 0);
    const maxQ = Math.max(...quantities, 5);

    const barW = chartW / neigeFraiche.length * 0.6;
    const gap = chartW / neigeFraiche.length;

    let bars = '', labels = '';
    neigeFraiche.forEach((n, i) => {
      const q = parseInt(n.quantite) || 0;
      const barH = (q / maxQ) * chartH;
      const x = padL + i * gap + gap * 0.2;
      const y = padT + chartH - barH;

      bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#4A90D9" rx="2"/>`;
      if (q > 0) {
        bars += `<text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#333" font-weight="bold">${q}</text>`;
      }

      // Date label
      const dateStr = n.date ? new Date(n.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
      labels += `<text x="${x + barW/2}" y="${h - 5}" text-anchor="middle" font-size="8" fill="#888">${dateStr}</text>`;
    });

    // Y axis
    const yAxis = `<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#ddd" stroke-width="1"/>
    <text x="${padL - 5}" y="${padT + 4}" text-anchor="end" font-size="8" fill="#888">${maxQ}cm</text>
    <text x="${padL - 5}" y="${padT + chartH}" text-anchor="end" font-size="8" fill="#888">0</text>`;

    return `<div class="bra-section">
      <h3>Neige fraîche</h3>
      <div class="snow-chart">
        <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px">
          ${yAxis}
          ${bars}
          ${labels}
        </svg>
      </div>
    </div>`;
  },

  // ─── WEATHER FORECAST ───

  renderMeteo(meteo) {
    if (!meteo || !meteo.echeances || meteo.echeances.length === 0) return '';

    let rows = '';
    meteo.echeances.forEach(e => {
      const date = e.date ? new Date(e.date) : null;
      const timeStr = date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      const iso0 = e.iso0 ? `${e.iso0} m` : '-';
      const vent = e.ventVitesse ? `${e.ventVitesse} km/h` : '-';
      const ventDir = e.ventDir || '';
      const pluieNeige = e.pluieNeige ? `${e.pluieNeige} m` : '-';

      rows += `<tr>
        <td>${timeStr}</td>
        <td>${iso0}</td>
        <td>${ventDir} ${vent}</td>
        <td>${pluieNeige}</td>
      </tr>`;
    });

    return `<div class="bra-section">
      <h3>Aperçu météo</h3>
      <div class="meteo-table-wrap">
        <table class="meteo-table">
          <thead><tr><th>Heure</th><th>Iso 0°C</th><th>Vent</th><th>Pluie/Neige</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  },

  // ─── RISK HISTORY (flags) ───

  renderRiskHistory(bsh) {
    if (!bsh || !bsh.risques || bsh.risques.length === 0) return '';

    let flags = '';
    bsh.risques.forEach(r => {
      const risk = parseInt(r.risqueMax) || 0;
      const color = RISK_COLORS[risk] || '#999';
      const textColor = RISK_TEXT_COLORS[risk] || '#FFF';
      const date = r.date ? new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';

      flags += `<div class="risk-history-item">
        <svg viewBox="0 0 30 35" width="28" height="33">
          <polygon points="15,2 28,17 15,32 2,17" fill="${color}" stroke="#333" stroke-width="1"/>
          <text x="15" y="20" text-anchor="middle" font-size="12" font-weight="bold" fill="${textColor}">${risk}</text>
        </svg>
        <span class="risk-history-date">${date}</span>
      </div>`;
    });

    return `<div class="bra-section">
      <h3>Historique du risque</h3>
      <div class="risk-history">${flags}</div>
    </div>`;
  },

  // ─── TENDANCE (Trend) ───

  renderTendance(tendance) {
    if (!tendance) return '';

    const riskVal = parseInt(tendance.risque) || 0;
    const text = tendance.texte || '';
    const date = tendance.date ? new Date(tendance.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '';

    let html = `<div class="bra-section tendance-section">
      <h3>Tendance${date ? ' - ' + date : ''}</h3>
      <div class="tendance-content">`;

    if (riskVal) {
      html += `<div class="tendance-flag">${this.renderRiskFlag(riskVal, 40)}</div>`;
    }
    if (text) {
      html += `<p>${text.replace(/\n/g, '<br>')}</p>`;
    }
    html += `</div></div>`;
    return html;
  },

  // ─── MAIN RENDER ───

  renderBRA(data) {
    const risk = data.riskMax || '?';
    const riskLabel = RISK_LABELS[risk] || 'Inconnu';
    const riskColor = RISK_COLORS[risk] || '#999';
    const textColor = RISK_TEXT_COLORS[risk] || '#FFF';

    this.badgeEl.textContent = `${risk} - ${riskLabel}`;
    this.badgeEl.style.backgroundColor = riskColor;
    this.badgeEl.style.color = textColor;

    let html = '';

    // ── Header: Date ──
    if (data.date) {
      const dateStr = new Date(data.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      const validStr = data.validUntil ? new Date(data.validUntil).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      }) : '';
      html += `<div class="bra-date">Rédigé le ${dateStr}${validStr ? ' — Valable pour le ' + validStr : ''}</div>`;
    }

    // ── Section 1: Estimation des risques (blue header like official BRA) ──
    html += `<div class="bra-card">`;
    html += `<div class="bra-card-header">Estimation des risques</div>`;
    html += `<div class="bra-card-body">`;

    // Risk flag + altitude split + compass rose
    const allOrientations = data.risks ? data.risks.flatMap(r => r.orientations || []) : [];
    const uniqueOrientations = [...new Set(allOrientations)];

    html += `<div class="risk-overview">`;

    // Left: risk flag(s)
    html += `<div class="risk-flags">`;
    if (data.risks && data.risks.length > 1) {
      // Multiple altitude zones
      data.risks.forEach(r => {
        html += `<div class="risk-altitude-row">
          ${this.renderRiskFlag(r.level, 44)}
          <span class="risk-alt-label">${r.altitude}m</span>
        </div>`;
      });
    } else {
      html += this.renderRiskFlag(risk, 56);
    }
    html += `</div>`;

    // Center: compass rose
    html += `<div class="risk-rose">${this.renderCompassRose(uniqueOrientations, 120)}</div>`;

    html += `</div>`; // risk-overview

    // Summary text
    if (data.summary) {
      html += `<div class="risk-summary">${data.summary.replace(/\n/g, '<br>')}</div>`;
    }

    html += `</div></div>`; // card body + card

    // ── Section 2: Stabilité du manteau neigeux ──
    if (data.stability || data.situationText) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Stabilité du manteau neigeux</div>`;
      html += `<div class="bra-card-body">`;

      // Situation avalancheuse typique with icons
      if (data.situations && data.situations.length > 0) {
        html += `<div class="situations-row">
          <span class="situations-label">Situation avalancheuse typique :</span>
          <div class="situations-icons">`;
        data.situations.forEach(s => {
          const label = SITUATIONS[s] || s;
          html += `<div class="situation-item">
            ${this.renderSituationIcon(s)}
            <span>${label}</span>
          </div>`;
        });
        html += `</div></div>`;
      } else if (data.situationText) {
        html += `<p class="situation-text"><strong>Situation avalancheuse typique :</strong> ${data.situationText}</p>`;
      }

      if (data.stability) {
        html += `<div class="stability-text">${data.stability.replace(/\n/g, '<br>')}</div>`;
      }
      html += `</div></div>`;
    }

    // ── Section 3: Qualité de la neige ──
    if (data.snowQuality) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Qualité de la neige</div>`;
      html += `<div class="bra-card-body">`;
      html += `<p>${data.snowQuality.replace(/\n/g, '<br>')}</p>`;
      html += `</div></div>`;
    }

    // ── Section 4: Épaisseur de neige ──
    if (data.enneigement) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Enneigement</div>`;
      html += `<div class="bra-card-body">`;
      html += this.renderSnowDepthDiagram(data.enneigement);
      html += `</div></div>`;
    }

    // ── Section 5: Neige fraîche ──
    if (data.neigeFraiche) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Précipitations</div>`;
      html += `<div class="bra-card-body">`;
      html += this.renderFreshSnowChart(data.neigeFraiche);
      html += `</div></div>`;
    }

    // ── Section 6: Météo ──
    if (data.meteo) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Aperçu météo</div>`;
      html += `<div class="bra-card-body">`;
      html += this.renderMeteo(data.meteo);
      html += `</div></div>`;
    }

    // ── Section 7: Tendance ──
    if (data.tendance) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Tendance</div>`;
      html += `<div class="bra-card-body">`;
      html += this.renderTendance(data.tendance);
      html += `</div></div>`;
    }

    // ── Section 8: Historique du risque ──
    if (data.bsh) {
      html += `<div class="bra-card">`;
      html += `<div class="bra-card-header">Historique</div>`;
      html += `<div class="bra-card-body">`;
      html += this.renderRiskHistory(data.bsh);
      html += `</div></div>`;
    }

    // ── Footer ──
    html += `<div class="bra-footer">Source : Météo-France</div>`;

    this.contentEl.innerHTML = html;
  },

  hide() {
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
