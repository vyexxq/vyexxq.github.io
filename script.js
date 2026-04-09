/* vyexx — shared script (home + subpages). Safe when optional DOM nodes are missing. */

const MOOD_KEYS = ['ocean', 'forest', 'frost', 'aurora'];

(function syncMoodFromStorage() {
    try {
        const s = localStorage.getItem('vyexx-mood');
        if (s && MOOD_KEYS.includes(s)) document.documentElement.setAttribute('data-mood', s);
    } catch (_) {
        /* ignore */
    }
    if (!document.documentElement.getAttribute('data-mood')) {
        document.documentElement.setAttribute('data-mood', 'ocean');
    }
})();

/** Canvas ribbon colors per mood (pairs with html[data-mood]) */
const VYEXX_MOOD_FLOW = {
    ocean: {
        bg: [2, 14, 32],
        hi: [120, 210, 255],
        mid: [40, 95, 140],
        deep: [0, 0, 0],
        hiMul: 1,
    },
    forest: {
        bg: [4, 20, 14],
        hi: [130, 255, 200],
        mid: [35, 110, 75],
        deep: [0, 10, 6],
        hiMul: 0.92,
    },
    frost: {
        bg: [12, 14, 22],
        hi: [235, 245, 255],
        mid: [130, 140, 165],
        deep: [0, 0, 0],
        hiMul: 1.08,
    },
    aurora: {
        bg: [10, 6, 26],
        hi: [210, 160, 255],
        mid: [85, 55, 150],
        deep: [0, 0, 0],
        hiMul: 1,
    },
};

const card = document.getElementById('tilt-card');
const cursor = document.getElementById('custom-cursor');
const shatterContainer = document.getElementById('shatter-container');
const crackFilter = document.getElementById('crack-displace');
let outline = document.getElementById('card-outline');

function ensureCardOutline() {
    if (outline) return outline;
    const el = document.createElement('div');
    el.id = 'card-outline';
    document.body.appendChild(el);
    outline = el;
    return outline;
}

function setupBubbleMount() {
    const existing = document.getElementById('bubble-layer');
    if (existing) return existing;
    const legacy = document.getElementById('bubbleCanvas');
    if (legacy && legacy.tagName === 'CANVAS') {
        const div = document.createElement('div');
        div.id = 'bubble-layer';
        div.setAttribute('aria-hidden', 'true');
        legacy.replaceWith(div);
        return div;
    }
    return null;
}

const bubbleLayer = setupBubbleMount();

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouse = { x: mouse.x, y: mouse.y };
let cardPos = { x: 0, y: 0 };
let cardVel = { x: 0, y: 0 };
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let dragStart = { x: 0, y: 0 };
let lastPointerLocal = { x: 0, y: 0 };
let activeCardPointerId = null;
let clickCount = 0;
let shards = [];

const CARD_WIDTH = () => (card ? card.offsetWidth : 380);

// --- 1. CLOCK (home only) ---
function updateClock() {
    const now = new Date();
    const dateEl = document.getElementById('date');
    const clockEl = document.getElementById('clock');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. CARD POSITION ---
function syncCardDimensions() {
    const inner = document.querySelector('.shard-content-inner');
    if (inner) inner.style.width = `${CARD_WIDTH()}px`;
}

function init() {
    if (!card || card.style.display === 'none') return;
    const r = card.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    cardPos.x = (window.innerWidth - r.width) / 2;
    cardPos.y = (window.innerHeight - r.height) / 2;
    card.style.left = `${cardPos.x}px`;
    card.style.top = `${cardPos.y}px`;
    syncCardDimensions();
}

window.addEventListener('load', init);
window.addEventListener('resize', init);

// --- CURSOR ---
if (cursor) {
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        cursor.style.left = `${mouse.x}px`;
        cursor.style.top = `${mouse.y}px`;
    });
}

// --- GLASS CRACKS (sharp lines at click; no whole-card blur) ---
const SVG_NS = 'http://www.w3.org/2000/svg';

function getCrackOverlay() {
    if (!card) return null;
    let el = card.querySelector('.glass-crack-overlay');
    if (!el) {
        el = document.createElement('div');
        el.className = 'glass-crack-overlay';
        el.setAttribute('aria-hidden', 'true');
        card.appendChild(el);
    }
    return el;
}

let crackSvgEl = null;

function ensureCrackSvg() {
    const host = getCrackOverlay();
    if (!host) return null;
    if (!crackSvgEl || !host.contains(crackSvgEl)) {
        crackSvgEl = document.createElementNS(SVG_NS, 'svg');
        crackSvgEl.setAttribute('width', '100%');
        crackSvgEl.setAttribute('height', '100%');
        crackSvgEl.setAttribute('viewBox', '0 0 100 100');
        crackSvgEl.setAttribute('preserveAspectRatio', 'none');
        host.appendChild(crackSvgEl);
    }
    return crackSvgEl;
}

function clearGlassCracks() {
    const host = card?.querySelector('.glass-crack-overlay');
    if (host) host.innerHTML = '';
    crackSvgEl = null;
    if (card) card.style.filter = 'none';
    if (crackFilter) crackFilter.setAttribute('scale', '0');
}

function randomBetween(a, b) {
    return a + Math.random() * (b - a);
}

/** Local coords relative to card padding box */
function addGlassCrackAtLocal(localX, localY) {
    const svg = ensureCrackSvg();
    if (!svg || !card) return;

    const px = (localX / card.offsetWidth) * 100;
    const py = (localY / card.offsetHeight) * 100;
    const g = document.createElementNS(SVG_NS, 'g');
    const nRays = 6 + Math.floor(Math.random() * 4);
    const reach = 95 + Math.random() * 35;

    for (let i = 0; i < nRays; i++) {
        const baseAng = (Math.PI * 2 * i) / nRays + randomBetween(-0.35, 0.35);
        let d = `M ${px.toFixed(2)} ${py.toFixed(2)}`;
        let cx = px;
        let cy = py;
        const segs = 4 + Math.floor(Math.random() * 4);
        for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const L = reach * t;
            const ang = baseAng + randomBetween(-0.45, 0.45);
            cx = px + Math.cos(ang) * L + randomBetween(-1.8, 1.8);
            cy = py + Math.sin(ang) * L + randomBetween(-1.8, 1.8);
            d += ` L ${cx.toFixed(2)} ${cy.toFixed(2)}`;
        }

        const hair = document.createElementNS(SVG_NS, 'path');
        hair.setAttribute('d', d);
        hair.setAttribute('fill', 'none');
        hair.setAttribute('stroke', 'rgba(0,0,0,0.45)');
        hair.setAttribute('stroke-width', '0.35');
        hair.setAttribute('stroke-linecap', 'round');
        hair.setAttribute('stroke-linejoin', 'miter');

        const main = document.createElementNS(SVG_NS, 'path');
        main.setAttribute('d', d);
        main.setAttribute('fill', 'none');
        main.setAttribute('stroke', 'rgba(255,255,255,0.72)');
        main.setAttribute('stroke-width', '0.55');
        main.setAttribute('stroke-linecap', 'round');
        main.setAttribute('stroke-linejoin', 'miter');

        g.appendChild(hair);
        g.appendChild(main);
    }
    svg.appendChild(g);
    playGlassTick();
}

// --- BUBBLES ---
const BUBBLE_MAX = 12;
const BUBBLE_ENTER_MS = 1450;
let bubbleSpawnTimer = null;

function placeBubble(el, size) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pad = 24;
    if (Math.random() < 0.62) {
        const edge = Math.floor(Math.random() * 4);
        if (edge === 0) {
            el.style.left = `${randomBetween(-size * 0.55, w - size * 0.45)}px`;
            el.style.top = `${randomBetween(-size * 0.85, h * 0.35)}px`;
        } else if (edge === 1) {
            el.style.left = `${randomBetween(w - size * 0.45, w + size * 0.35)}px`;
            el.style.top = `${randomBetween(-size * 0.35, h - size * 0.4)}px`;
        } else if (edge === 2) {
            el.style.left = `${randomBetween(-size * 0.45, w * 0.55)}px`;
            el.style.top = `${randomBetween(h - size * 0.45, h + size * 0.4)}px`;
        } else {
            el.style.left = `${randomBetween(-size * 0.4, w - size * 0.5)}px`;
            el.style.top = `${randomBetween(h * 0.4, h - size * 0.35)}px`;
        }
    } else {
        el.style.left = `${randomBetween(pad * 0.4, w - size - pad * 0.4)}px`;
        el.style.top = `${randomBetween(pad * 0.4, h - size - pad * 0.4)}px`;
    }
}

function spawnBubble() {
    if (!bubbleLayer || document.hidden) return;
    const existing = bubbleLayer.querySelectorAll('.bubble:not(.popping)');
    if (existing.length >= BUBBLE_MAX) return;

    const el = document.createElement('div');
    el.className = 'bubble';
    const size = randomBetween(22, 62);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    placeBubble(el, size);

    const blurPx = randomBetween(3.2, 7.2);
    const op = randomBetween(0.28, 0.52);
    el.style.setProperty('--blur', `${blurPx}px`);
    el.style.setProperty('--b-op', String(op));
    el.style.setProperty('--float-delay', `${BUBBLE_ENTER_MS / 1000}s`);
    el.style.setProperty('--float-dur', `${randomBetween(16, 28)}s`);
    el.style.setProperty('--dx1', `${randomBetween(-18, 18)}px`);
    el.style.setProperty('--dy1', `${randomBetween(-22, 22)}px`);
    el.style.setProperty('--dx2', `${randomBetween(-16, 16)}px`);
    el.style.setProperty('--dy2', `${randomBetween(-18, 18)}px`);
    el.style.setProperty('--dx3', `${randomBetween(-14, 14)}px`);
    el.style.setProperty('--dy3', `${randomBetween(-16, 16)}px`);

    const pop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        popBubble(el);
    };
    el.addEventListener('mousedown', pop);
    el.addEventListener('touchstart', pop, { passive: false });

    bubbleLayer.appendChild(el);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('is-live'));
    });

    window.setTimeout(() => {
        if (el.parentNode && !el.classList.contains('popping')) el.remove();
    }, 70000);
}

function popBubble(el) {
    if (!el || el.classList.contains('popping') || !bubbleLayer) return;
    el.classList.remove('is-live');
    el.classList.add('popping');
    const rect = el.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top + rect.height / 2;
    const n = 6;
    for (let i = 0; i < n; i++) {
        const sp = document.createElement('div');
        sp.className = 'bubble-spark';
        sp.style.left = `${ox - 3}px`;
        sp.style.top = `${oy - 3}px`;
        const ang = (Math.PI * 2 * i) / n + randomBetween(-0.25, 0.25);
        const dist = randomBetween(22, 44);
        sp.style.setProperty('--sx', `${Math.cos(ang) * dist}px`);
        sp.style.setProperty('--sy', `${Math.sin(ang) * dist}px`);
        bubbleLayer.appendChild(sp);
        window.setTimeout(() => sp.remove(), 600);
    }
    window.setTimeout(() => el.remove(), 520);
}

function scheduleBubbleSpawn() {
    bubbleSpawnTimer = window.setTimeout(() => {
        spawnBubble();
        scheduleBubbleSpawn();
    }, randomBetween(2800, 4800));
}

function startBubbles() {
    if (!bubbleLayer || bubbleSpawnTimer) return;
    spawnBubble();
    scheduleBubbleSpawn();
}

function stopBubbles() {
    if (bubbleSpawnTimer) {
        clearTimeout(bubbleSpawnTimer);
        bubbleSpawnTimer = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBubbles();
    else startBubbles();
});

startBubbles();

// --- FLOW CANVAS: 4 strands, tuned for weak GPUs (no shadowBlur, no string pass) ---
(function initOrganicFlow() {
    function findOrCreateCanvas() {
        const host = document.querySelector('.background-waves, .background-streams');
        let c = document.getElementById('flow-field');
        if (c) {
            if (host) {
                host.querySelectorAll('.stream').forEach((el) => {
                    el.style.display = 'none';
                });
            }
            return c;
        }
        if (!host) return null;
        c = document.createElement('canvas');
        c.id = 'flow-field';
        c.setAttribute('aria-hidden', 'true');
        host.insertBefore(c, host.firstChild);
        host.querySelectorAll('.stream').forEach((el) => {
            el.style.display = 'none';
        });
        return c;
    }

    const canvas = findOrCreateCanvas();
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;

    let flowMoodKey = document.documentElement.getAttribute('data-mood') || 'ocean';
    if (!MOOD_KEYS.includes(flowMoodKey)) flowMoodKey = 'ocean';

    function flowPalette() {
        return VYEXX_MOOD_FLOW[flowMoodKey] || VYEXX_MOOD_FLOW.ocean;
    }

    window.vyexxSetFlowMood = (k) => {
        flowMoodKey = MOOD_KEYS.includes(k) ? k : 'ocean';
    };

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData =
        typeof navigator !== 'undefined' &&
        navigator.connection &&
        navigator.connection.saveData === true;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let strands = [];
    let resizeTimer = 0;
    let frameSkip = 0;

    function pickDpr() {
        const raw = window.devicePixelRatio || 1;
        if (saveData || prefersReduced) return 1;
        if (window.innerWidth < 720) return Math.min(raw, 1.25);
        if (window.innerWidth < 1200) return Math.min(raw, 1.5);
        return Math.min(raw, 2);
    }

    function rnd(a, b) {
        return a + Math.random() * (b - a);
    }

    function buildStrands() {
        const bases = [0.22, 0.42, 0.58, 0.76].map((t) => h * t + rnd(-h * 0.04, h * 0.04));
        strands = [];
        for (let i = 0; i < 4; i++) {
            const depth = i / 3;
            strands.push({
                seed: Math.random() * 10000,
                baseY: bases[i],
                depth,
                drift: 0,
                driftVel: 0,
                a1: rnd(36, 84) * (0.65 + depth * 0.45),
                a2: rnd(18, 44),
                a3: rnd(10, 30),
                a4: rnd(6, 18),
                k1: rnd(0.0035, 0.014),
                k2: rnd(0.006, 0.02),
                k3: rnd(0.0015, 0.009),
                w1: rnd(0.06, 0.16) * (i % 2 === 0 ? 1 : -1),
                w2: rnd(0.05, 0.14),
                w3: rnd(0.03, 0.12) * (i % 2 === 1 ? 1 : -1),
                p1: rnd(0, Math.PI * 2),
                p2: rnd(0, Math.PI * 2),
                p3: rnd(0, Math.PI * 2),
                thickness: rnd(84, 140),
                alpha: rnd(0.22, 0.42) * (0.75 + depth * 0.25),
                floatSpeed: rnd(0.045, 0.1),
                floatAmp: rnd(10, 24),
            });
        }
    }

    function strandY(x, timeSec, s) {
        const base = s.baseY + Math.sin(timeSec * s.floatSpeed + s.seed) * s.floatAmp;
        let y = base;
        y += s.a1 * Math.sin(x * s.k1 + timeSec * s.w1 + s.p1 + s.drift);
        y += s.a2 * Math.sin(x * s.k2 - timeSec * s.w2 + s.p2);
        y += s.a3 * Math.sin(x * s.k3 + timeSec * s.w3 + s.p3);
        const n =
            Math.sin(timeSec * 0.09 + s.seed * 0.01 + x * 0.0014) * 0.5 +
            Math.sin(timeSec * 0.15 + x * 0.0025 + s.seed) * 0.32;
        y += s.a4 * n;
        return y;
    }

    function thickAt(x, timeSec, s) {
        return s.thickness * (0.86 + 0.14 * Math.sin(x * 0.0022 + timeSec * 0.07 + s.seed));
    }

    function updateDrifts() {
        for (let i = 0; i < strands.length; i++) {
            const s = strands[i];
            s.driftVel += (Math.random() - 0.5) * 0.0014;
            s.driftVel *= 0.988;
            s.drift += s.driftVel;
            if (s.drift > 0.85) s.drift = 0.85;
            if (s.drift < -0.85) s.drift = -0.85;
        }
    }

    function drawRibbon(timeSec, s) {
        const step = 20;
        const margin = 120;
        const top = [];
        for (let x = -margin; x <= w + margin; x += step) {
            top.push({ x, y: strandY(x, timeSec, s) });
        }
        let minY = 1e9;
        let maxY = -1e9;
        for (let i = 0; i < top.length; i++) {
            const p = top[i];
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        const bottom = [];
        for (let i = top.length - 1; i >= 0; i--) {
            const p = top[i];
            const bt = p.y + thickAt(p.x, timeSec, s);
            maxY = Math.max(maxY, bt);
            bottom.push({ x: p.x, y: bt });
        }

        const p = flowPalette();
        const g = ctx.createLinearGradient(0, minY - 24, 0, maxY + 32);
        const hiA = (0.05 + s.depth * 0.12) * p.hiMul;
        g.addColorStop(0, `rgba(${p.hi[0]},${p.hi[1]},${p.hi[2]},${hiA})`);
        g.addColorStop(0.4, `rgba(${p.mid[0]},${p.mid[1]},${p.mid[2]},${0.05 + s.depth * 0.1})`);
        g.addColorStop(1, `rgba(${p.deep[0]},${p.deep[1]},${p.deep[2]},${0.3 + s.depth * 0.22})`);

        ctx.beginPath();
        ctx.moveTo(top[0].x, top[0].y);
        for (let i = 1; i < top.length; i++) ctx.lineTo(top[i].x, top[i].y);
        for (let i = 0; i < bottom.length; i++) ctx.lineTo(bottom[i].x, bottom[i].y);
        ctx.closePath();

        ctx.save();
        ctx.globalAlpha = Math.min(0.95, s.alpha * 2.2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
    }

    function resize() {
        dpr = pickDpr();
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildStrands();
    }

    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            resize();
            if (prefersReduced) drawStatic(5.7);
        }, 120);
    });

    function drawStatic(timeSec) {
        const p = flowPalette();
        ctx.fillStyle = `rgb(${p.bg[0]},${p.bg[1]},${p.bg[2]})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < strands.length; i++) drawRibbon(timeSec, strands[i]);
    }

    function tick(ts) {
        requestAnimationFrame(tick);
        if (document.hidden) return;

        const timeSec = ts * 0.001;
        frameSkip ^= 1;
        if (frameSkip === 0) updateDrifts();

        const p = flowPalette();
        ctx.fillStyle = `rgb(${p.bg[0]},${p.bg[1]},${p.bg[2]})`;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < strands.length; i++) drawRibbon(timeSec, strands[i]);
    }

    resize();

    if (prefersReduced) {
        drawStatic(5.7);
    } else {
        requestAnimationFrame(tick);
    }
})();

// --- DRAG & CRACK CLICKS ---
if (card) {
    card.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('.mag-button')) return;
        if (e.target.closest('a[href]')) return;
        activeCardPointerId = e.pointerId;
        isDragging = true;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        dragOffset.x = e.clientX - cardPos.x;
        dragOffset.y = e.clientY - cardPos.y;
        const r = card.getBoundingClientRect();
        lastPointerLocal.x = e.clientX - r.left;
        lastPointerLocal.y = e.clientY - r.top;
        card.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
}

function onGlobalPointerUp(e) {
    if (!card) return;
    if (isDragging && (activeCardPointerId === null || activeCardPointerId === e.pointerId)) {
        if (e) {
            const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
            if (dist < 12) {
                clickCount += 1;
                addGlassCrackAtLocal(lastPointerLocal.x, lastPointerLocal.y);
                if (clickCount >= 5) shatter();
            }
        }
        isDragging = false;
        activeCardPointerId = null;
    }
    shards.forEach((s) => {
        if (s.isDragging && (s.activePointerId === null || s.activePointerId === e.pointerId)) {
            s.isDragging = false;
            s.activePointerId = null;
        }
    });
}

window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('pointerup', onGlobalPointerUp);
window.addEventListener('pointercancel', onGlobalPointerUp);
window.addEventListener('blur', () => {
    isDragging = false;
    activeCardPointerId = null;
    shards.forEach((s) => {
        s.isDragging = false;
        s.activePointerId = null;
    });
});

// --- SHATTER ---
function shatter() {
    if (!card) return;
    playGlassShatter();
    const ol = ensureCardOutline();
    const r = card.getBoundingClientRect();
    const fullHtml = card.innerHTML;
    const cardHeight = card.offsetHeight;
    const wPx = r.width;

    ol.style.width = `${r.width}px`;
    ol.style.height = `${cardHeight}px`;
    ol.style.left = `${cardPos.x}px`;
    ol.style.top = `${cardPos.y}px`;
    ol.style.display = 'block';

    card.style.display = 'none';
    clearGlassCracks();
    if (shatterContainer) shatterContainer.innerHTML = '';
    shards = [];

    const rows = 4;
    const cols = 4;
    const cw = r.width / cols;
    const ch = cardHeight / rows;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const shardEl = document.createElement('div');
            shardEl.className = 'shard';
            shardEl.style.width = `${cw}px`;
            shardEl.style.height = `${ch}px`;

            const innerContent = document.createElement('div');
            innerContent.className = 'shard-content-inner';
            innerContent.innerHTML = fullHtml;
            innerContent.style.width = `${wPx}px`;
            innerContent.style.height = `${cardHeight}px`;
            innerContent.style.left = `-${j * cw}px`;
            innerContent.style.top = `-${i * ch}px`;

            shardEl.appendChild(innerContent);
            if (shatterContainer) shatterContainer.appendChild(shardEl);

            const sObj = {
                el: shardEl,
                x: cardPos.x + j * cw,
                y: cardPos.y + i * ch,
                homeX: j * cw,
                homeY: i * ch,
                vx: (Math.random() - 0.5) * 45,
                vy: (Math.random() - 0.5) * 45,
                w: cw,
                h: ch,
                isDragging: false,
                isSnapped: false,
                activePointerId: null,
                offset: { x: 0, y: 0 },
            };

            shardEl.addEventListener('pointerdown', (ev) => {
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                ev.preventDefault();
                sObj.isDragging = true;
                sObj.isSnapped = false;
                sObj.activePointerId = ev.pointerId;
                shardEl.classList.remove('snapped');
                sObj.offset.x = ev.clientX - sObj.x;
                sObj.offset.y = ev.clientY - sObj.y;
                shardEl.setPointerCapture(ev.pointerId);
            });

            shards.push(sObj);
        }
    }
}

function clampShardX(s) {
    if (s.x < 0) {
        s.x = 0;
        s.vx *= -0.5;
    } else if (s.x + s.w > window.innerWidth) {
        s.x = window.innerWidth - s.w;
        s.vx *= -0.5;
    }
}

function animate() {
    if (card && card.style.display !== 'none') {
        const r = card.getBoundingClientRect();
        if (isDragging) {
            cardPos.x = mouse.x - dragOffset.x;
            cardPos.y = mouse.y - dragOffset.y;
            cardVel.x = (mouse.x - lastMouse.x) * 0.8;
            cardVel.y = (mouse.y - lastMouse.y) * 0.8;
        } else {
            cardPos.x += cardVel.x;
            cardPos.y += cardVel.y;
            cardVel.x *= 0.98;
            cardVel.y *= 0.98;

            if (cardPos.x < 0) {
                cardPos.x = 0;
                cardVel.x *= -0.7;
            }
            if (cardPos.x + r.width > window.innerWidth) {
                cardPos.x = window.innerWidth - r.width;
                cardVel.x *= -0.7;
            }
            if (cardPos.y < 0) {
                cardPos.y = 0;
                cardVel.y *= -0.7;
            }
            if (cardPos.y + r.height > window.innerHeight) {
                cardPos.y = window.innerHeight - r.height;
                cardVel.y *= -0.7;
            }
        }
        card.style.left = `${cardPos.x}px`;
        card.style.top = `${cardPos.y}px`;
    }

    shards.forEach((s) => {
        if (s.isSnapped) {
            s.x = cardPos.x + s.homeX;
            s.y = cardPos.y + s.homeY;
        } else if (s.isDragging) {
            s.x = mouse.x - s.offset.x;
            s.y = mouse.y - s.offset.y;
            s.vx = mouse.x - lastMouse.x;
            s.vy = mouse.y - lastMouse.y;

            const targetX = cardPos.x + s.homeX;
            const targetY = cardPos.y + s.homeY;
            if (Math.hypot(s.x - targetX, s.y - targetY) < 25) {
                s.x = targetX;
                s.y = targetY;
                s.isSnapped = true;
                s.isDragging = false;
                s.el.classList.add('snapped');
                s.vx = 0;
                s.vy = 0;
                checkHealStatus();
            }
        } else {
            s.vy += 0.5;
            s.x += s.vx;
            s.y += s.vy;
            s.vx *= 0.99;
            s.vy *= 0.99;

            if (s.y > window.innerHeight - s.h) {
                s.y = window.innerHeight - s.h;
                s.vy *= -0.5;
            }
            clampShardX(s);
        }
        s.el.style.left = `${s.x}px`;
        s.el.style.top = `${s.y}px`;
    });

    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;
    requestAnimationFrame(animate);
}

// --- Mood scenes UI + audio + magnetic (declared before sounds use them) ---
let currentMoodKey = document.documentElement.getAttribute('data-mood') || 'ocean';
if (!MOOD_KEYS.includes(currentMoodKey)) currentMoodKey = 'ocean';

const prefersReducedSound = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let audioCtx = null;
let masterGain = null;
let ambienceNodes = null;

function ensureAudioCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = prefersReducedSound ? 0 : 0.22;
        masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
}

function resumeAudio() {
    const ctx = ensureAudioCtx();
    if (!ctx || !masterGain) return Promise.resolve(null);
    if (ctx.state === 'suspended') return ctx.resume().then(() => ctx);
    return Promise.resolve(ctx);
}

function playButtonSoft() {
    if (prefersReducedSound) return;
    const ctx = ensureAudioCtx();
    if (!ctx || !masterGain) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(700, t0);
    o.frequency.exponentialRampToValueAtTime(360, t0 + 0.048);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.1, t0 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.09);
    o.connect(g);
    g.connect(masterGain);
    o.start(t0);
    o.stop(t0 + 0.11);
}

function playGlassTick() {
    if (prefersReducedSound) return;
    const ctx = ensureAudioCtx();
    if (!ctx || !masterGain) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.055);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(masterGain);
    src.start(t0);
}

function playGlassShatter() {
    if (prefersReducedSound) return;
    const ctx = ensureAudioCtx();
    if (!ctx || !masterGain) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.32);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 0.35);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t0);
    bp.frequency.exponentialRampToValueAtTime(380, t0 + 0.22);
    bp.Q.value = 0.75;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.2, t0 + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.3);
    src.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src.start(t0);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(38, t0 + 0.18);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0, t0);
    g2.gain.linearRampToValueAtTime(0.055, t0 + 0.012);
    g2.gain.exponentialRampToValueAtTime(0.0004, t0 + 0.2);
    o.connect(g2);
    g2.connect(masterGain);
    o.start(t0);
    o.stop(t0 + 0.22);
}

const AMBIENCE_PRESETS = {
    ocean: { freq: 360, wet: 0.082, lfoF: 0.11, lfoD: 155 },
    forest: { freq: 510, wet: 0.052, lfoF: 0.17, lfoD: 92 },
    frost: { freq: 690, wet: 0.036, lfoF: 0.24, lfoD: 210 },
    aurora: { freq: 275, wet: 0.058, lfoF: 0.088, lfoD: 105 },
};

function startAmbienceForMood(moodKey) {
    if (prefersReducedSound || ambienceNodes) return;
    const ctx = ensureAudioCtx();
    if (!ctx || !masterGain) return;
    const t0 = ctx.currentTime;
    const pr = AMBIENCE_PRESETS[moodKey] || AMBIENCE_PRESETS.ocean;
    const n = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = pr.freq;
    band.Q.value = 0.62;
    const wet = ctx.createGain();
    wet.gain.value = pr.wet;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pr.lfoF;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = pr.lfoD;
    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);
    src.connect(band);
    band.connect(wet);
    wet.connect(masterGain);
    src.start(t0);
    lfo.start(t0);
    ambienceNodes = { band, wet, lfo, lfoGain };
}

function updateAmbienceForMood(moodKey) {
    if (!ambienceNodes || !audioCtx) return;
    const pr = AMBIENCE_PRESETS[moodKey] || AMBIENCE_PRESETS.ocean;
    const t = audioCtx.currentTime;
    ambienceNodes.band.frequency.linearRampToValueAtTime(pr.freq, t + 1);
    ambienceNodes.wet.gain.linearRampToValueAtTime(pr.wet, t + 1);
    ambienceNodes.lfo.frequency.linearRampToValueAtTime(pr.lfoF, t + 1);
    ambienceNodes.lfoGain.gain.linearRampToValueAtTime(pr.lfoD, t + 1);
}

function refreshMoodPressedStates() {
    const k = document.documentElement.getAttribute('data-mood') || 'ocean';
    document.querySelectorAll('.mood-dot').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.mood === k ? 'true' : 'false');
    });
}

function applyMood(key) {
    if (!MOOD_KEYS.includes(key)) return;
    currentMoodKey = key;
    document.documentElement.setAttribute('data-mood', key);
    try {
        localStorage.setItem('vyexx-mood', key);
    } catch (_) {
        /* ignore */
    }
    if (window.vyexxSetFlowMood) window.vyexxSetFlowMood(key);
    refreshMoodPressedStates();
    updateAmbienceForMood(key);
}

function ensureMoodDock() {
    if (document.getElementById('mood-dock')) return;
    const dock = document.createElement('div');
    dock.id = 'mood-dock';
    dock.setAttribute('role', 'toolbar');
    dock.setAttribute('aria-label', 'Mood scenes');
    const lab = document.createElement('span');
    lab.className = 'mood-dock__label';
    lab.textContent = 'Mood';
    dock.appendChild(lab);
    const specs = [
        ['ocean', 'mood-dot--ocean', 'Deep ocean'],
        ['forest', 'mood-dot--forest', 'Forest night'],
        ['frost', 'mood-dot--frost', 'Frost white'],
        ['aurora', 'mood-dot--aurora', 'Aurora haze'],
    ];
    for (let i = 0; i < specs.length; i++) {
        const [mood, cls, title] = specs[i];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `mood-dot ${cls}`;
        b.dataset.mood = mood;
        b.title = title;
        b.setAttribute('aria-label', `${title} mood`);
        b.addEventListener('click', () => applyMood(mood));
        dock.appendChild(b);
    }
    document.body.appendChild(dock);
    refreshMoodPressedStates();
}

const magneticOn = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MAG_STR = 0.34;
const MAG_RAD = 175;

function magneticLoop() {
    if (magneticOn) {
        const nodes = document.querySelectorAll('.mag-button, .mood-dot');
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const dx = mouse.x - cx;
            const dy = mouse.y - cy;
            const dist = Math.hypot(dx, dy) + 0.001;
            const pull = Math.min(13, (MAG_RAD / dist) * MAG_STR * 7);
            const tx = (dx / dist) * pull;
            const ty = (dy / dist) * pull;
            el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        }
    }
    requestAnimationFrame(magneticLoop);
}

document.addEventListener(
    'pointerdown',
    (e) => {
        resumeAudio().then(() => {
            if (prefersReducedSound || ambienceNodes) return;
            startAmbienceForMood(currentMoodKey);
        });
        const t = e.target;
        if (t && t.closest && t.closest('.mag-button, .mood-dot')) playButtonSoft();
    },
    true
);

ensureMoodDock();
magneticLoop();

function checkHealStatus() {
    if (!card || shards.length === 0 || !shards.every((s) => s.isSnapped)) return;
    shards.forEach((s) => s.el.classList.add('healing'));

    window.setTimeout(() => {
        card.style.display = 'block';
        card.style.filter = 'none';
        card.style.opacity = '0';

        let op = 0;
        const fadeIn = window.setInterval(() => {
            op += 0.1;
            card.style.opacity = String(Math.min(op, 1));
            if (op >= 1) {
                window.clearInterval(fadeIn);
                card.style.opacity = '1';
                clearGlassCracks();
                const ol = document.getElementById('card-outline');
                if (ol) ol.style.display = 'none';
                if (shatterContainer) shatterContainer.innerHTML = '';
                shards = [];
                clickCount = 0;
            }
        }, 30);
    }, 600);
}

animate();
