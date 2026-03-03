export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function formatNumber(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—';
    }

    return new Intl.NumberFormat('en-US').format(value);
}

export function formatCompact(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '—';
    }

    const compact = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(value);

    return compact.replace('K', 'k').replace('M', 'm').replace('B', 'b');
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatRelativeDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    const ms = Date.now() - date.getTime();
    const day = 24 * 60 * 60 * 1000;
    const days = Math.floor(ms / day);

    if (days <= 0) {
        return 'today';
    }
    if (days === 1) {
        return '1 day ago';
    }
    if (days < 30) {
        return `${days} days ago`;
    }

    const months = Math.floor(days / 30);
    if (months === 1) {
        return '1 month ago';
    }
    if (months < 12) {
        return `${months} months ago`;
    }

    const years = Math.floor(months / 12);
    return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

export function safeObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value;
}

export function ensureElement(selector) {
    return document.querySelector(selector);
}

export function setTextContent(element, value) {
    if (!element) {
        return;
    }

    element.textContent = value ?? '—';
}

export function sumBy(items, selector) {
    return safeArray(items).reduce((total, item) => {
        const value = selector(item);
        return typeof value === 'number' ? total + value : total;
    }, 0);
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function createSVGElement(name, attributes = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => {
        el.setAttribute(key, String(value));
    });
    return el;
}

export function makeListItem(html) {
    const li = document.createElement('li');
    li.innerHTML = html;
    return li;
}
