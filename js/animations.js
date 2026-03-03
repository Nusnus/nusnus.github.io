import { prefersReducedMotion } from './utils.js';

function setStaggerIndices() {
    const groups = document.querySelectorAll('[data-stagger-group]');
    groups.forEach((group) => {
        const children = Array.from(group.children);
        children.forEach((child, index) => {
            if (!(child instanceof HTMLElement) || child.dataset.noReveal === 'true') {
                return;
            }

            if (!child.classList.contains('fade-in')) {
                child.classList.add('fade-in');
            }

            child.style.setProperty('--stagger-index', String(index));
        });
    });
}

function initRevealAnimations() {
    const revealTargets = document.querySelectorAll('.fade-in');
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach((el) => el.classList.add('visible'));
        return;
    }

    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.2,
            rootMargin: '0px 0px -12% 0px'
        }
    );

    revealTargets.forEach((el) => revealObserver.observe(el));
}

function initStickyNav() {
    const nav = document.getElementById('nav');
    const hero = document.getElementById('hero');

    if (!nav || !hero || !('IntersectionObserver' in window)) {
        if (nav) {
            nav.classList.add('visible');
        }
        return;
    }

    const navObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                nav.classList.toggle('visible', !entry.isIntersecting);
            });
        },
        { threshold: 0.08 }
    );

    navObserver.observe(hero);

    const onScroll = () => {
        nav.classList.toggle('scrolled', window.scrollY > 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
}

function initSectionAwareNav() {
    const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
    const sections = navLinks
        .map((link) => document.querySelector(link.getAttribute('href')))
        .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) {
        return;
    }

    const sectionToLink = new Map();
    navLinks.forEach((link) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            sectionToLink.set(target.id, link);
        }
    });

    const activeObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                navLinks.forEach((link) => {
                    link.classList.remove('active');
                    link.removeAttribute('aria-current');
                });

                const link = sectionToLink.get(entry.target.id);
                if (link) {
                    link.classList.add('active');
                    link.setAttribute('aria-current', 'true');
                }
            });
        },
        {
            threshold: 0.45,
            rootMargin: '-20% 0px -40% 0px'
        }
    );

    sections.forEach((section) => activeObserver.observe(section));
}

function initAnchorScrolling() {
    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach((anchor) => {
        anchor.addEventListener('click', (event) => {
            const href = anchor.getAttribute('href');
            if (!href || href === '#') {
                return;
            }

            const target = document.querySelector(href);
            if (!target) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });
        });
    });
}

export function initAnimations() {
    setStaggerIndices();
    initRevealAnimations();
    initStickyNav();
    initSectionAwareNav();
    initAnchorScrolling();
}
