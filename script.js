/* vyexx — shared script (home + subpages). Safe when optional DOM nodes are missing. */

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
                a1: rnd(22, 52) * (0.55 + depth * 0.35),
                a2: rnd(12, 32),
                a3: rnd(7, 22),
                a4: rnd(4, 12),
                k1: rnd(0.0035, 0.014),
                k2: rnd(0.006, 0.02),
                k3: rnd(0.0015, 0.009),
                w1: rnd(0.06, 0.16) * (i % 2 === 0 ? 1 : -1),
                w2: rnd(0.05, 0.14),
                w3: rnd(0.03, 0.12) * (i % 2 === 1 ? 1 : -1),
                p1: rnd(0, Math.PI * 2),
                p2: rnd(0, Math.PI * 2),
                p3: rnd(0, Math.PI * 2),
                thickness: rnd(52, 92),
                alpha: rnd(0.22, 0.42) * (0.75 + depth * 0.25),
                floatSpeed: rnd(0.045, 0.1),
                floatAmp: rnd(6, 16),
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
        const step = 18;
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

        const g = ctx.createLinearGradient(0, minY - 24, 0, maxY + 32);
        const hi = 0.06 + s.depth * 0.14;
        g.addColorStop(0, `rgba(255,255,255,${hi})`);
        g.addColorStop(0.4, `rgba(120,120,120,${0.04 + s.depth * 0.08})`);
        g.addColorStop(1, `rgba(0,0,0,${0.28 + s.depth * 0.22})`);

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
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < strands.length; i++) drawRibbon(timeSec, strands[i]);
    }

    function tick(ts) {
        requestAnimationFrame(tick);
        if (document.hidden) return;

        const timeSec = ts * 0.001;
        frameSkip ^= 1;
        if (frameSkip === 0) updateDrifts();

        ctx.fillStyle = '#000000';
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
    card.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.mag-button')) return;
        if (e.target.closest('a[href]')) return;
        isDragging = true;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        dragOffset.x = e.clientX - cardPos.x;
        dragOffset.y = e.clientY - cardPos.y;
        const r = card.getBoundingClientRect();
        lastPointerLocal.x = e.clientX - r.left;
        lastPointerLocal.y = e.clientY - r.top;
    });
}

function onGlobalMouseUp(e) {
    if (!card) return;
    if (isDragging) {
        if (e) {
            const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
            if (dist < 12) {
                clickCount += 1;
                addGlassCrackAtLocal(lastPointerLocal.x, lastPointerLocal.y);
                if (clickCount >= 5) shatter();
            }
        }
        isDragging = false;
    }
    shards.forEach((s) => {
        s.isDragging = false;
    });
}

window.addEventListener('mouseup', onGlobalMouseUp);
window.addEventListener('blur', () => {
    isDragging = false;
    shards.forEach((s) => {
        s.isDragging = false;
    });
});

// --- SHATTER ---
function shatter() {
    if (!card) return;
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
                offset: { x: 0, y: 0 },
            };

            shardEl.addEventListener('mousedown', (ev) => {
                if (ev.button !== 0) return;
                ev.preventDefault();
                sObj.isDragging = true;
                sObj.isSnapped = false;
                shardEl.classList.remove('snapped');
                sObj.offset.x = ev.clientX - sObj.x;
                sObj.offset.y = ev.clientY - sObj.y;
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
