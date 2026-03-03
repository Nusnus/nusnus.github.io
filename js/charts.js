import { clamp, createSVGElement, formatDate, formatNumber, safeArray } from './utils.js';

const NS = 'http://www.w3.org/2000/svg';

let tooltip;

function ensureTooltip() {
    if (tooltip) {
        return tooltip;
    }

    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    tooltip.setAttribute('role', 'status');
    tooltip.setAttribute('aria-live', 'polite');
    document.body.appendChild(tooltip);
    return tooltip;
}

function bindTooltip(target, text) {
    const tip = ensureTooltip();

    const onMove = (event) => {
        tip.textContent = text;
        tip.style.left = `${event.clientX}px`;
        tip.style.top = `${event.clientY}px`;
        tip.classList.add('visible');
    };

    const onLeave = () => {
        tip.classList.remove('visible');
    };

    target.addEventListener('mousemove', onMove);
    target.addEventListener('mouseenter', onMove);
    target.addEventListener('mouseleave', onLeave);
    target.addEventListener('blur', onLeave);
}

export function renderEmptyChart(container, message) {
    if (!container) {
        return;
    }

    container.innerHTML = `<div class="chart-empty">${message}</div>`;
}

function resolveHeatmapColor(count, maxCount) {
    if (!count || count <= 0) {
        return 'rgba(255, 255, 255, 0.08)';
    }

    const ratio = count / Math.max(1, maxCount);
    if (ratio <= 0.25) {
        return 'rgba(108, 159, 255, 0.32)';
    }
    if (ratio <= 0.5) {
        return 'rgba(108, 159, 255, 0.5)';
    }
    if (ratio <= 0.75) {
        return 'rgba(108, 159, 255, 0.72)';
    }
    return 'rgba(154, 185, 255, 0.94)';
}

export function renderContributionHeatmap(container, daysInput) {
    const days = safeArray(daysInput).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!container) {
        return;
    }

    if (!days.length) {
        renderEmptyChart(container, 'Contribution data unavailable');
        return;
    }

    const parsedDates = days
        .map((day) => ({
            ...day,
            dateObj: new Date(`${day.date}T00:00:00Z`)
        }))
        .filter((day) => !Number.isNaN(day.dateObj.getTime()));

    if (!parsedDates.length) {
        renderEmptyChart(container, 'Contribution data unavailable');
        return;
    }

    const firstDate = parsedDates[0].dateObj;
    const start = new Date(firstDate);
    start.setUTCDate(firstDate.getUTCDate() - firstDate.getUTCDay());

    const size = 10;
    const gap = 3;
    const left = 24;
    const top = 22;

    const maxCount = parsedDates.reduce((max, day) => Math.max(max, Number(day.count) || Number(day.contributionCount) || 0), 0);

    let maxWeek = 0;
    parsedDates.forEach((day) => {
        const diffDays = Math.floor((day.dateObj.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        day.week = Math.max(0, Math.floor(diffDays / 7));
        day.weekday = typeof day.weekday === 'number' ? day.weekday : day.dateObj.getUTCDay();
        maxWeek = Math.max(maxWeek, day.week);
    });

    const width = left + (maxWeek + 1) * (size + gap) + 8;
    const height = top + 7 * (size + gap) + 14;

    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': 'Contribution heatmap chart',
        xmlns: NS
    });

    const labels = ['Sun', 'Tue', 'Thu'];
    labels.forEach((label, index) => {
        const y = top + (index * 2 + 0.8) * (size + gap);
        const text = createSVGElement('text', {
            x: 0,
            y,
            fill: 'rgba(176, 180, 195, 0.65)',
            'font-size': 8,
            'font-family': 'Inter, sans-serif'
        });
        text.textContent = label;
        svg.appendChild(text);
    });

    parsedDates.forEach((day) => {
        const count = Number(day.count) || Number(day.contributionCount) || 0;
        const x = left + day.week * (size + gap);
        const y = top + day.weekday * (size + gap);

        const rect = createSVGElement('rect', {
            x,
            y,
            width: size,
            height: size,
            rx: 2,
            fill: resolveHeatmapColor(count, maxCount),
            class: 'heatmap-cell'
        });

        const dayText = formatDate(day.dateObj.toISOString(), { month: 'short', day: 'numeric', year: 'numeric' });
        bindTooltip(rect, `${formatNumber(count)} contributions on ${dayText}`);
        svg.appendChild(rect);
    });

    container.replaceChildren(svg);
}

function normalizePoints(pointsInput) {
    return safeArray(pointsInput)
        .map((point) => ({
            label: point.label || point.date || point.month || point.week_start || '',
            value: Number(point.value ?? point.count ?? 0)
        }))
        .filter((point) => Number.isFinite(point.value));
}

export function renderLineChart(container, pointsInput, options = {}) {
    if (!container) {
        return;
    }

    const points = normalizePoints(pointsInput);
    if (!points.length) {
        renderEmptyChart(container, options.emptyMessage || 'Trend data unavailable');
        return;
    }

    const width = 560;
    const height = options.height || 150;
    const padX = 20;
    const padY = 16;
    const chartWidth = width - padX * 2;
    const chartHeight = height - padY * 2;

    const maxValue = points.reduce((max, point) => Math.max(max, point.value), 0);
    const minValue = points.reduce((min, point) => Math.min(min, point.value), Number.MAX_SAFE_INTEGER);
    const range = Math.max(1, maxValue - Math.min(0, minValue));

    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': options.ariaLabel || 'Line chart',
        xmlns: NS
    });

    for (let i = 0; i < 4; i += 1) {
        const y = padY + (chartHeight / 3) * i;
        svg.appendChild(createSVGElement('line', {
            x1: padX,
            y1: y,
            x2: width - padX,
            y2: y,
            class: 'chart-grid-line'
        }));
    }

    const coords = points.map((point, index) => {
        const x = points.length === 1
            ? width / 2
            : padX + (index / (points.length - 1)) * chartWidth;
        const normalized = (point.value - Math.min(0, minValue)) / range;
        const y = padY + chartHeight - normalized * chartHeight;
        return { ...point, x, y };
    });

    const d = coords
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');

    svg.appendChild(createSVGElement('path', { d, class: 'chart-line' }));

    coords.forEach((point) => {
        const circle = createSVGElement('circle', {
            cx: point.x,
            cy: point.y,
            r: 3.2,
            class: 'chart-point'
        });
        bindTooltip(circle, `${point.label}: ${formatNumber(point.value)}`);
        svg.appendChild(circle);
    });

    container.replaceChildren(svg);
}

export function renderBarChart(container, pointsInput, options = {}) {
    if (!container) {
        return;
    }

    const points = normalizePoints(pointsInput);
    if (!points.length) {
        renderEmptyChart(container, options.emptyMessage || 'Bar data unavailable');
        return;
    }

    const width = 560;
    const height = options.height || 130;
    const padX = 16;
    const padY = 16;
    const chartWidth = width - padX * 2;
    const chartHeight = height - padY * 2;

    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const barGap = 3;
    const barWidth = Math.max(2, (chartWidth - barGap * (points.length - 1)) / points.length);

    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': options.ariaLabel || 'Bar chart',
        xmlns: NS
    });

    points.forEach((point, index) => {
        const x = padX + index * (barWidth + barGap);
        const normalized = clamp(point.value / maxValue, 0, 1);
        const h = Math.max(1, normalized * chartHeight);
        const y = padY + chartHeight - h;

        const rect = createSVGElement('rect', {
            x,
            y,
            width: barWidth,
            height: h,
            rx: Math.min(2, barWidth / 2),
            class: 'bar-segment'
        });

        bindTooltip(rect, `${point.label}: ${formatNumber(point.value)}`);
        svg.appendChild(rect);
    });

    container.replaceChildren(svg);
}

export function renderDonutChart(container, segmentsInput) {
    if (!container) {
        return;
    }

    const segments = safeArray(segmentsInput)
        .map((segment) => ({
            label: segment.language || segment.label || 'Unknown',
            value: Number(segment.bytes ?? segment.value ?? 0),
            color: segment.color || '#6c9fff'
        }))
        .filter((segment) => segment.value > 0);

    if (!segments.length) {
        renderEmptyChart(container, 'Language data unavailable');
        return;
    }

    const width = 260;
    const height = 260;
    const cx = width / 2;
    const cy = height / 2;
    const outer = 100;
    const inner = 58;

    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    let startAngle = -Math.PI / 2;

    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': 'Language distribution donut chart',
        xmlns: NS
    });

    segments.forEach((segment) => {
        const portion = segment.value / total;
        const angle = portion * Math.PI * 2;
        const endAngle = startAngle + angle;

        const x1 = cx + Math.cos(startAngle) * outer;
        const y1 = cy + Math.sin(startAngle) * outer;
        const x2 = cx + Math.cos(endAngle) * outer;
        const y2 = cy + Math.sin(endAngle) * outer;
        const x3 = cx + Math.cos(endAngle) * inner;
        const y3 = cy + Math.sin(endAngle) * inner;
        const x4 = cx + Math.cos(startAngle) * inner;
        const y4 = cy + Math.sin(startAngle) * inner;
        const largeArc = angle > Math.PI ? 1 : 0;

        const d = [
            `M ${x1} ${y1}`,
            `A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}`,
            `L ${x3} ${y3}`,
            `A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}`,
            'Z'
        ].join(' ');

        const path = createSVGElement('path', {
            d,
            fill: segment.color,
            class: 'donut-segment'
        });

        const percentage = ((segment.value / total) * 100).toFixed(1);
        bindTooltip(path, `${segment.label}: ${formatNumber(segment.value)} bytes (${percentage}%)`);
        svg.appendChild(path);

        startAngle = endAngle;
    });

    const centerText = createSVGElement('text', {
        x: cx,
        y: cy - 3,
        'text-anchor': 'middle',
        fill: '#f5f7ff',
        'font-size': 17,
        'font-family': 'Space Grotesk, sans-serif',
        'font-weight': 650
    });
    centerText.textContent = formatNumber(total);

    const centerSub = createSVGElement('text', {
        x: cx,
        y: cy + 17,
        'text-anchor': 'middle',
        fill: 'rgba(176, 180, 195, 0.75)',
        'font-size': 11,
        'font-family': 'Inter, sans-serif'
    });
    centerSub.textContent = 'language bytes';

    svg.append(centerText, centerSub);

    container.replaceChildren(svg);
}

export function renderYoyPills(container, itemsInput) {
    if (!container) {
        return;
    }

    const items = safeArray(itemsInput);
    if (!items.length) {
        container.innerHTML = '<div class="chart-empty">Year-over-year data unavailable</div>';
        return;
    }

    container.innerHTML = '';
    items.forEach((item, index) => {
        const prev = index > 0 ? items[index - 1] : null;
        const delta = prev && typeof prev.total === 'number' && prev.total > 0
            ? (((item.total - prev.total) / prev.total) * 100)
            : null;

        const pill = document.createElement('div');
        pill.className = 'yoy-pill';
        pill.innerHTML = `
            <span class="year">${item.year}</span>
            <span class="value">${formatNumber(item.total)} contributions</span>
            <span class="delta">${delta === null ? 'Baseline year' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs previous year`}</span>
        `;
        container.appendChild(pill);
    });
}
