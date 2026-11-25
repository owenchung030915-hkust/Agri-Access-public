/**
 * Downloadable credit analysis memorandum.
 * The ensemble score is the rating. Land sources are written into the same file.
 */
(function (root) {
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function prettyToken(value) {
        const text = String(value || '').replace(/_/g, ' ').trim();
        if (!text || text === 'none') return text === 'none' ? 'No collateral' : '';
        return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function featureLabel(name) {
        const known = {
            farm_size: 'Farm size',
            collateral_land: 'Land collateral',
            weather_temperature: 'Temperature',
            weather_humidity: 'Humidity',
            loan_amount_M: 'Loan amount',
            crop_rice: 'Rice',
            latitude: 'Latitude',
            longitude: 'Longitude',
            prithvi_vegetation: 'Satellite vegetation',
            prithvi_crop_health: 'Satellite crop condition',
            weather_rainfall: 'Weather rainfall'
        };
        if (known[name]) return known[name];
        return String(name || 'Feature').replace(/_/g, ' ');
    }

    function kolektibilitasLabel(code) {
        return {
            1: 'Lancar',
            2: 'Dalam perhatian khusus',
            3: 'Kurang lancar',
            4: 'Diragukan',
            5: 'Macet'
        }[Number(code)] || '—';
    }

    function scoreRing(score) {
        const value = Math.max(300, Math.min(850, Number(score) || 300));
        const portion = (value - 300) / 550;
        const radius = 52;
        const circumference = 2 * Math.PI * radius;
        const drawn = (portion * circumference).toFixed(1);
        const color = portion >= 0.62 ? '#1f7a4d' : portion >= 0.38 ? '#a68446' : '#8d3d2f';
        return ''
            + '<svg class="ring" viewBox="0 0 140 140" role="img" aria-label="Score ' + Math.round(value) + '">'
            + '<circle cx="70" cy="70" r="' + radius + '" fill="none" stroke="#e6dfd2" stroke-width="9"/>'
            + '<circle cx="70" cy="70" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" '
            + 'stroke-dasharray="' + drawn + ' ' + circumference.toFixed(1) + '" transform="rotate(-90 70 70)"/>'
            + '<text x="70" y="66" text-anchor="middle" font-size="32" font-family="Fraunces, Georgia, serif" fill="#132019">' + Math.round(value) + '</text>'
            + '<text x="70" y="86" text-anchor="middle" font-size="9" letter-spacing="2" fill="#4d6157">300–850</text>'
            + '</svg>';
    }

    function ndviSvg(points) {
        if (!points || points.length < 2) return '';
        const width = 640;
        const height = 120;
        const pad = 12;
        const values = points.map((point) => Number(point.ndvi));
        const min = Math.min(0.15, ...values);
        const max = Math.max(0.75, ...values);
        const step = (width - pad * 2) / (points.length - 1);
        const coords = values.map((value, index) => {
            const x = pad + index * step;
            const y = pad + (1 - (value - min) / (max - min || 1)) * (height - pad * 2);
            return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        const last = values[values.length - 1];
        const lastX = pad + (values.length - 1) * step;
        const lastY = pad + (1 - (last - min) / (max - min || 1)) * (height - pad * 2);
        return ''
            + '<svg class="spark" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="NDVI curve">'
            + '<polyline fill="none" stroke="#1a5c44" stroke-width="3" points="' + coords + '"/>'
            + '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="4" fill="#0f3d2e"/>'
            + '</svg>';
    }

    function shapRows(explanations) {
        const rows = (explanations && (explanations.Credit_Score || explanations.credit_score)) || [];
        if (!Array.isArray(rows)) return [];
        return rows.slice().sort((a, b) => Math.abs(b.shap_value || 0) - Math.abs(a.shap_value || 0)).slice(0, 6);
    }

    function shapHtml(explanations) {
        const rows = shapRows(explanations);
        if (!rows.length) return '<p class="muted">Driver detail was not returned with this run.</p>';
        const max = Math.max(...rows.map((row) => Math.abs(Number(row.shap_value) || 0)), 0.01);
        return rows.map((row) => {
            const value = Number(row.shap_value) || 0;
            const width = Math.max(8, Math.round(Math.abs(value) / max * 100));
            const tone = value >= 0 ? 'up' : 'down';
            const word = value >= 0 ? 'Supports the score' : 'Presses the score down';
            return ''
                + '<div class="driver">'
                + '<div class="driver-name">' + esc(featureLabel(row.feature)) + '<span>' + esc(word) + '</span></div>'
                + '<div class="bar ' + tone + '"><span style="width:' + width + '%"></span></div>'
                + '</div>';
        }).join('');
    }

    function bearings(evidence) {
        const notes = [];
        const soil = evidence.soilgrids || {};
        const rain = evidence.rainfall || {};
        const plants = evidence.vegetation || {};
        const market = evidence.market || {};
        const fire = evidence.fire || {};
        const flood = evidence.flood || {};
        if (soil.ok) {
            notes.push(Number(soil.ph) < 5.5
                ? 'SoilGrids pH ' + soil.ph + ' is acidic. Treat it as a map prior and confirm it before any lime decision.'
                : 'SoilGrids pH ' + soil.ph + ' sits in a range many annual crops tolerate. It remains a map prior, not a lab sample.');
        }
        if (rain.ok) {
            notes.push(rain.season + ' rainfall was ' + rain.season_mm + ' mm against a normal of ' + rain.normal_mm + ' mm (' + rain.signal + '). This is the ERA5 cell, not a field gauge.');
        }
        if (plants.ok) {
            notes.push('MODIS NDVI averages ' + plants.mean + ', with the latest composite at ' + plants.latest + ' on ' + plants.latest_date + '.');
        }
        if (market.ok && market.cover_ratio != null) {
            notes.push(market.cover_ratio >= 1
                ? 'At the planning yield, one normal season is ' + market.cover_ratio + '× the requested principal.'
                : 'At the planning yield, one normal season covers ' + market.cover_ratio + '× the requested principal.');
        }
        if (fire.ok) {
            notes.push(fire.flag
                ? 'A fire record is open near the farm.'
                : 'No open wildfire is listed in the fire source used for this pin.');
        }
        if (flood.ok && flood.flag) {
            notes.push('The nearest river pixel is running well above its seasonal mean.');
        }
        return notes;
    }

    function sourceList(result) {
        const rows = result.sources_considered || [];
        if (!rows.length) return '';
        return '<ul class="sources">' + rows.map((row) =>
            '<li class="' + (row.status === 'included' ? 'in' : 'out') + '"><strong>' + esc(row.name) + '</strong><span>' + esc(row.detail) + '</span></li>'
        ).join('') + '</ul>';
    }

    function screenFigures() {
        function text(id) {
            const node = typeof document !== 'undefined' ? document.getElementById(id) : null;
            return node ? node.textContent.trim() : '';
        }
        return {
            interest: text('interestRate'),
            approval: text('approvalProbability'),
            requested: text('requestedLoanAmount'),
            maximum: text('maxLoanAmount'),
            term: text('loanTermDisplay')
        };
    }

    function render(result, screen) {
        const view = screen || screenFigures();
        const basel = (result && result.basel_iii_results) || {};
        const formatted = (result && result.formatted_results) || {};
        const farm = (result && result.farm_data) || {};
        const evidence = (result && result.land_evidence) || {};
        const score = formatted.credit_score_rounded || Math.round(Number(basel.credit_score) || 0);
        const farmer = farm.farmer_name || 'This farm';
        const when = result && result.timestamp ? String(result.timestamp).slice(0, 10) : '';
        const soil = evidence.soilgrids || {};
        const rain = evidence.rainfall || {};
        const plants = evidence.vegetation || {};
        const market = evidence.market || {};
        const fire = evidence.fire || {};
        const flood = evidence.flood || {};
        const uses = evidence.uses || [];
        const lead = bearings(evidence);
        const sentinel = plants.sentinel || {};

        return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
            + '<title>Credit analysis — ' + esc(farmer) + '</title>'
            + '<link rel="preconnect" href="https://fonts.googleapis.com">'
            + '<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,620&family=Outfit:wght@380;520;650&display=swap" rel="stylesheet">'
            + '<style>'
            + 'body{margin:0;background:#e7e1d4;color:#132019;font-family:Outfit,Helvetica,sans-serif;font-weight:380;}'
            + '.toolbar{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 22px;background:#0f3d2e;color:#f7f4ee;}'
            + '.toolbar button{background:#f3eee4;color:#0f3d2e;border:0;border-radius:999px;padding:10px 16px;font:650 13px Outfit,sans-serif;cursor:pointer;}'
            + '.page{width:min(920px,calc(100% - 32px));margin:22px auto 40px;background:#f7f4ee;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(19,32,25,.12);}'
            + '.mast{display:flex;justify-content:space-between;gap:24px;padding:36px 40px 28px;background:linear-gradient(160deg,#0f3d2e,#1a5c44);color:#f7f4ee;}'
            + '.kicker{letter-spacing:.22em;text-transform:uppercase;font-size:11px;opacity:.8;margin:0 0 8px;}'
            + 'h1{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:40px;line-height:1.05;margin:0;}'
            + '.mast p{margin:8px 0 0;max-width:460px;line-height:1.45;opacity:.92;}'
            + '.score-card{background:#f7f4ee;color:#132019;border-radius:16px;padding:8px 16px 12px;text-align:center;min-width:150px;}'
            + '.score-card small{display:block;letter-spacing:.14em;text-transform:uppercase;font-size:10px;color:#4d6157;}'
            + '.body{padding:8px 40px 36px;}'
            + '.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:22px 0;}'
            + '.fact{background:#fff;border:1px solid #e4ddd0;border-radius:12px;padding:12px 14px;}'
            + '.fact span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#4d6157;}'
            + '.fact strong{display:block;margin-top:4px;font-size:15px;font-weight:650;}'
            + 'h2{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:26px;margin:28px 0 8px;}'
            + '.lede{font-size:16px;line-height:1.5;margin:0 0 8px;}'
            + '.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}'
            + '.metric{padding:14px;border-radius:12px;background:#e7f2eb;}'
            + '.metric span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#1a5c44;}'
            + '.metric strong{font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:560;}'
            + '.driver{margin:10px 0 14px;}'
            + '.driver-name{display:flex;justify-content:space-between;gap:12px;font-size:14px;font-weight:520;}'
            + '.driver-name span{color:#4d6157;font-weight:380;}'
            + '.bar{height:8px;background:#efe8dc;border-radius:99px;margin-top:6px;overflow:hidden;}'
            + '.bar span{display:block;height:100%;border-radius:99px;}'
            + '.bar.up span{background:#1f7a4d;}.bar.down span{background:#8d3d2f;}'
            + '.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;}'
            + '.card{background:#fff;border:1px solid #e4ddd0;border-radius:14px;padding:14px 16px;}'
            + '.card h3{margin:0 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#1a5c44;}'
            + '.card p{margin:0;line-height:1.45;font-size:14px;}'
            + '.spark{width:100%;height:120px;background:#e7f2eb;border-radius:12px;margin-top:8px;}'
            + '.read{margin:0 0 10px;line-height:1.5;}'
            + '.sources{list-style:none;padding:0;margin:8px 0 0;}'
            + '.sources li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid #e4ddd0;font-size:14px;}'
            + '.sources strong{font-weight:650;}'
            + '.sources span{color:#4d6157;text-align:right;}'
            + '.sources .out strong{color:#8d3d2f;}'
            + '.close{margin-top:22px;padding-top:14px;border-top:1px solid #e4ddd0;color:#4d6157;font-size:13px;line-height:1.5;}'
            + '@media(max-width:720px){.facts,.metrics,.cards{grid-template-columns:1fr 1fr}.mast,h1{display:block}.mast h1{font-size:32px}}'
            + '@media print{.toolbar{display:none}body{background:#fff}.page{width:auto;margin:0;box-shadow:none;border-radius:0}}'
            + '</style></head><body>'
            + '<div class="toolbar"><div>Agri-Accept · credit analysis</div><button type="button" onclick="window.print()">Save as PDF</button></div>'
            + '<article class="page"><header class="mast"><div>'
            + '<p class="kicker">AgriRisk Intelligence Engine</p>'
            + '<h1>' + esc(farmer) + '</h1>'
            + '<p>Credit analysis for the farm on file. The rating is the ensemble score. Soil, season, vegetation, price, and hazard readings were gathered with it and are set out below.</p>'
            + '</div><div class="score-card">' + scoreRing(score) + '<small>' + esc(basel.slik_label || 'Platform score') + '</small></div></header>'
            + '<div class="body">'
            + '<div class="facts">'
            + fact('Crop', farm.crop_type)
            + fact('Area', farm.farm_size ? farm.farm_size + ' ha' : '')
            + fact('Location', farm.latitude != null ? Number(farm.latitude).toFixed(3) + ', ' + Number(farm.longitude).toFixed(3) : '')
            + fact('Date', when)
            + fact('Requested', view.requested)
            + fact('Term', view.term)
            + fact('Purpose', prettyToken(farm.loan_purpose))
            + fact('Collateral', prettyToken(farm.collateral_type))
            + '</div>'
            + '<h2>The rating</h2>'
            + '<p class="lede">Score ' + esc(score) + ' on the platform’s 300–850 scale'
            + (basel.slik_label ? ', read as ' + esc(basel.slik_label) : '')
            + '. Kolektibilitas ' + esc(basel.kolektibilitas) + ' (' + esc(kolektibilitasLabel(basel.kolektibilitas)) + '). '
            + esc(lead.join(' ')) + '</p>'
            + '<div class="metrics">'
            + metric('Probability of default', formatted.pd_percentage)
            + metric('Loss given default', formatted.lgd_percentage)
            + metric('Exposure at default', formatted.ead_formatted)
            + metric('Expected credit loss', formatted.ecl_formatted)
            + metric('Indicative rate', view.interest)
            + metric('Approval probability', view.approval)
            + '</div>'
            + '<h2>What moved the score</h2>'
            + '<p class="lede">Each bar is that feature’s pull on the ensemble score. Land readings on the next section are in the file; they are not extra weights inside this chart.</p>'
            + shapHtml(result.shap_explanations)
            + '<h2>Land sources in this file</h2>'
            + '<div class="cards">'
            + card('Soil', soil.ok
                ? 'pH ' + soil.ph + ' · organic carbon ' + soil.organic_carbon_g_kg + ' g/kg · nitrogen ' + soil.nitrogen_g_kg + ' g/kg · clay ' + soil.clay_percent + '%. ' + (soil.source || '')
                : (soil.error || 'SoilGrids did not return a profile.'))
            + card('Seasonal rainfall', rain.ok
                ? rain.season + ': ' + rain.season_mm + ' mm. Normal ' + rain.normal_mm + ' mm (' + rain.anomaly_percent + '%, ' + rain.signal + '). ' + rain.source
                : (rain.error || 'Rainfall history was not returned.'))
            + card('Crop value', market.ok
                ? market.instrument + ' near USD ' + market.usd_per_tonne + '/t. ' + market.season_value_label + ' for a normal season'
                    + (market.cover_ratio != null ? ', ' + market.cover_ratio + '× the requested ' + market.loan_label : '') + '.'
                : (market.error || 'No price comparison for this crop.'))
            + card('Hazards', [fireLine(fire), floodLine(flood)].filter(Boolean).join(' ') || 'Hazard readings were not returned.')
            + '</div>'
            + (plants.ok
                ? '<div class="card" style="margin-top:12px"><h3>Vegetation</h3><p>Latest NDVI ' + esc(plants.latest) + ' on ' + esc(plants.latest_date)
                    + '. Mean ' + esc(plants.mean) + '. ' + esc(plants.source) + '.'
                    + (sentinel.ok ? ' Sentinel-2 scenes under 40% cloud: ' + esc(sentinel.scenes_capped ? 'at least ' + sentinel.scenes : sentinel.scenes) + '.' : '')
                    + '</p>' + ndviSvg(plants.points) + '</div>'
                : '')
            + '<h2>How to read the file</h2>'
            + (uses.length ? uses.map((line) => '<p class="read">' + esc(line) + '</p>').join('') : '<p class="read">The written reading was not returned with this run.</p>')
            + '<h2>Sources gathered</h2>'
            + sourceList(result)
            + '<p class="close">The ' + esc(score) + ' figure is Agri-Accept’s own score from the satellite, weather, and farm ensemble. It is not an external bureau score, and it is not a validated capital model. Approval of the loan remains with the bank. A laboratory soil sample is still the figure that should justify lime.</p>'
            + '</div></article></body></html>';
    }

    function fact(label, value) {
        if (value == null || value === '' || value === '---') return '';
        return '<div class="fact"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
    }

    function metric(label, value) {
        if (!value || value === '---') return '';
        return '<div class="metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
    }

    function card(title, body) {
        return '<div class="card"><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></div>';
    }

    function fireLine(fire) {
        if (!fire || (!fire.ok && !fire.error)) return '';
        if (!fire.ok) return fire.error;
        return fire.flag
            ? fire.source + ': ' + fire.hotspots + ' active records.'
            : fire.source + ': none listed.';
    }

    function floodLine(flood) {
        if (!flood || !flood.ok) return flood && flood.error ? flood.error : '';
        return flood.source + ': peak ' + flood.peak_m3s + ' m³/s.';
    }

    function download(result) {
        const html = render(result, screenFigures());
        const farm = (result && result.farm_data) || {};
        const slug = String(farm.farmer_name || 'farm').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'farm';
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Agri-Accept-Credit-Analysis-' + slug + '.html';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    }

    root.AgriCreditReport = { render: render, download: download };
})(typeof window !== 'undefined' ? window : globalThis);
