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

  // SVG risk flag (European avalanche danger scale diamond)
  renderRiskFlag(level) {
    const color = RISK_COLORS[level] || '#999';
    const textColor = RISK_TEXT_COLORS[level] || '#FFF';
    const label = RISK_LABELS[level] || '?';
    return `<div class="risk-flag">
      <svg viewBox="0 0 60 70" width="60" height="70">
        <polygon points="30,5 55,35 30,65 5,35" fill="${color}" stroke="#333" stroke-width="2"/>
        <text x="30" y="40" text-anchor="middle" font-size="24" font-weight="bold" fill="${textColor}">${level}</text>
      </svg>
      <span class="risk-flag-label" style="color:${color}">${label}</span>
    </div>`;
  },

  // SVG compass rose showing dangerous orientations
  renderCompassRose(orientations) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    const cx = 60, cy = 60, r = 50, rInner = 18;

    let sectors = '';
    dirs.forEach((dir, i) => {
      const active = orientations && orientations.includes(dir);
      const a1 = (angles[i] - 22.5) * Math.PI / 180;
      const a2 = (angles[i] + 22.5) * Math.PI / 180;
      const x1 = cx + r * Math.sin(a1);
      const y1 = cy - r * Math.cos(a1);
      const x2 = cx + r * Math.sin(a2);
      const y2 = cy - r * Math.cos(a2);
      const xi1 = cx + rInner * Math.sin(a1);
      const yi1 = cy - rInner * Math.cos(a1);
      const xi2 = cx + rInner * Math.sin(a2);
      const yi2 = cy - rInner * Math.cos(a2);
      const fill = active ? '#E63946' : '#E8E8E8';
      sectors += `<path d="M${xi1.toFixed(1)},${yi1.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0,1 ${x2.toFixed(1)},${y2.toFixed(1)} L${xi2.toFixed(1)},${yi2.toFixed(1)} A${rInner},${rInner} 0 0,0 ${xi1.toFixed(1)},${yi1.toFixed(1)}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
    });

    const labelR = r + 12;
    let labels = '';
    dirs.forEach((dir, i) => {
      const a = angles[i] * Math.PI / 180;
      const x = cx + labelR * Math.sin(a);
      const y = cy - labelR * Math.cos(a);
      const bold = orientations && orientations.includes(dir);
      labels += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="${bold ? 11 : 9}" font-weight="${bold ? 'bold' : 'normal'}" fill="${bold ? '#E63946' : '#888'}">${dir}</text>`;
    });

    return `<div class="compass-rose">
      <svg viewBox="-5 -5 130 130" width="140" height="140">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ddd" stroke-width="0.5"/>
        ${sectors}
        <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="white" stroke="#ddd" stroke-width="1"/>
        ${labels}
      </svg>
    </div>`;
  },

  // SVG icons for each avalanche situation type
  renderSituationIcon(situation) {
    const icons = {
      'neige_fraiche': `<svg viewBox="0 0 40 40" width="36" height="36">
        <circle cx="20" cy="12" r="3" fill="#4A90D9"/>
        <line x1="20" y1="4" x2="20" y2="20" stroke="#4A90D9" stroke-width="2"/>
        <line x1="13" y1="8" x2="27" y2="16" stroke="#4A90D9" stroke-width="2"/>
        <line x1="27" y1="8" x2="13" y2="16" stroke="#4A90D9" stroke-width="2"/>
        <rect x="5" y="24" width="30" height="3" rx="1" fill="#4A90D9" opacity="0.3"/>
        <rect x="5" y="29" width="30" height="3" rx="1" fill="#4A90D9" opacity="0.5"/>
        <rect x="5" y="34" width="30" height="3" rx="1" fill="#4A90D9" opacity="0.7"/>
      </svg>`,
      'plaque_vent': `<svg viewBox="0 0 40 40" width="36" height="36">
        <polygon points="8,35 20,10 32,35" fill="none" stroke="#E67E22" stroke-width="2"/>
        <path d="M5,8 Q15,4 20,8 Q25,12 35,8" fill="none" stroke="#E67E22" stroke-width="2"/>
        <path d="M8,14 Q18,10 23,14 Q28,18 35,14" fill="none" stroke="#E67E22" stroke-width="1.5" opacity="0.6"/>
        <line x1="15" y1="28" x2="25" y2="28" stroke="#E67E22" stroke-width="2"/>
      </svg>`,
      'sous_couche_fragile': `<svg viewBox="0 0 40 40" width="36" height="36">
        <rect x="5" y="8" width="30" height="6" rx="1" fill="#8E44AD" opacity="0.4"/>
        <rect x="5" y="16" width="30" height="6" rx="1" fill="#8E44AD" opacity="0.6"/>
        <line x1="8" y1="24" x2="12" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <line x1="12" y1="24" x2="8" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <line x1="18" y1="24" x2="22" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <line x1="22" y1="24" x2="18" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <line x1="28" y1="24" x2="32" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <line x1="32" y1="24" x2="28" y2="28" stroke="#E74C3C" stroke-width="2"/>
        <rect x="5" y="30" width="30" height="6" rx="1" fill="#8E44AD" opacity="0.8"/>
      </svg>`,
      'neige_humide': `<svg viewBox="0 0 40 40" width="36" height="36">
        <circle cx="20" cy="10" r="6" fill="#3498DB" opacity="0.3"/>
        <path d="M14,20 Q17,28 20,20 Q23,28 26,20" fill="none" stroke="#3498DB" stroke-width="2"/>
        <path d="M10,26 Q13,34 16,26 Q19,34 22,26 Q25,34 28,26" fill="none" stroke="#3498DB" stroke-width="1.5" opacity="0.7"/>
        <polygon points="8,35 20,15 32,35" fill="none" stroke="#3498DB" stroke-width="1.5"/>
      </svg>`,
      'glissement': `<svg viewBox="0 0 40 40" width="36" height="36">
        <polygon points="5,35 20,8 35,35" fill="none" stroke="#27AE60" stroke-width="2"/>
        <path d="M12,28 C15,24 25,24 28,28" fill="none" stroke="#27AE60" stroke-width="2"/>
        <line x1="12" y1="32" x2="28" y2="32" stroke="#27AE60" stroke-width="2"/>
        <path d="M15,20 L20,14 L25,20" fill="none" stroke="#27AE60" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      'situation_favorable': `<svg viewBox="0 0 40 40" width="36" height="36">
        <circle cx="20" cy="20" r="14" fill="none" stroke="#52B788" stroke-width="2"/>
        <path d="M12,20 L18,26 L28,14" fill="none" stroke="#52B788" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
    };
    return icons[situation] || '';
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

    // Risk flag + compass rose side by side
    const allOrientations = data.risks ? data.risks.flatMap(r => r.orientations || []) : [];
    const uniqueOrientations = [...new Set(allOrientations)];
    html += `<div class="bra-visuals">
      ${this.renderRiskFlag(risk)}
      ${this.renderCompassRose(uniqueOrientations)}
    </div>`;

    // Risk by altitude with diamond icons
    if (data.risks && data.risks.length > 0) {
      html += `<div class="bra-section">
        <h3>Risque par altitude</h3>
        <div class="risk-altitude-cards">`;
      data.risks.forEach(r => {
        const color = RISK_COLORS[r.level] || '#999';
        const txtColor = RISK_TEXT_COLORS[r.level] || '#FFF';
        const orientations = r.orientations ? r.orientations.join(', ') : 'Toutes';
        html += `<div class="risk-altitude-card">
          <div class="risk-altitude-level">
            <svg viewBox="0 0 40 46" width="32" height="38">
              <polygon points="20,3 37,23 20,43 3,23" fill="${color}" stroke="#333" stroke-width="1.5"/>
              <text x="20" y="27" text-anchor="middle" font-size="16" font-weight="bold" fill="${txtColor}">${r.level}</text>
            </svg>
          </div>
          <div class="risk-altitude-info">
            <strong>${r.altitude}m</strong>
            <span class="risk-altitude-orientations">${orientations}</span>
          </div>
        </div>`;
      });
      html += `</div></div>`;
    }

    // Typical situations with icons
    if (data.situations && data.situations.length > 0) {
      html += `<div class="bra-section"><h3>Situations avalancheuses typiques</h3><div class="situations-grid">`;
      data.situations.forEach(s => {
        const label = SITUATIONS[s] || s;
        const icon = this.renderSituationIcon(s);
        html += `<div class="situation-card">
          ${icon}
          <span class="situation-label">${label}</span>
        </div>`;
      });
      html += `</div></div>`;
    }

    // Summary
    if (data.summary) {
      html += `<div class="bra-section"><h3>Résumé</h3><p>${data.summary.replace(/\n/g, '<br>')}</p></div>`;
    }

    // Stability
    if (data.stability) {
      html += `<div class="bra-section"><h3>Stabilité du manteau neigeux</h3><p>${data.stability.replace(/\n/g, '<br>')}</p></div>`;
    } else {
      if (data.accidental) {
        html += `<div class="bra-section"><h3>Déclenchements provoqués</h3><p>${data.accidental.replace(/\n/g, '<br>')}</p></div>`;
      }
      if (data.natural) {
        html += `<div class="bra-section"><h3>Départs spontanés</h3><p>${data.natural.replace(/\n/g, '<br>')}</p></div>`;
      }
    }

    // Snow quality
    if (data.snowQuality) {
      html += `<div class="bra-section"><h3>Qualité de la neige</h3><p>${data.snowQuality.replace(/\n/g, '<br>')}</p></div>`;
    }

    this.contentEl.innerHTML = html;
  },

  hide() {
    this.panelEl.classList.remove('open');
    this.isOpen = false;
    MapManager.deselectMassif();
  }
};
