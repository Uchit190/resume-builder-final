// ===== theme.js — Shared Dark/Light Mode Toggle =====
const saved = localStorage.getItem('rf-theme') || 'light';
document.documentElement.setAttribute('data-theme', saved);

function updateViewportHeight() {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-vh', `${viewportHeight}px`);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rf-theme', next);
}

document.addEventListener('DOMContentLoaded', function () {
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewportHeight);
        window.visualViewport.addEventListener('scroll', updateViewportHeight);
    }

    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', toggleTheme);

    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', e => {
            const target = link.getAttribute('target');
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && target !== '_blank' && !href.startsWith('javascript:')) {
                e.preventDefault();
                document.body.classList.add('page-leave');
                setTimeout(() => { window.location.href = href; }, 400);
            }
        });
    });
});
// ── Particle Canvas Animation ──
document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    const PARTICLE_COUNT = 55;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.4,
        dx: (Math.random() - 0.5) * 0.35,
        dy: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.5 + 0.15,
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const color = isDark() ? '160,160,255' : '91,94,244';

        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${p.alpha})`;
            ctx.fill();

            p.x += p.dx;
            p.y += p.dy;

            if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        });

        requestAnimationFrame(draw);
    }

    draw();

});
