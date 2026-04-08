// Clean URL
if (window.location.pathname.endsWith("index.html")) {
    const cleanUrl = window.location.pathname.replace("index.html", "");
    window.history.replaceState({}, document.title, cleanUrl);
}

const card = document.getElementById('tilt-card');
const cursor = document.getElementById('custom-cursor');
const shatterContainer = document.getElementById('shatter-container');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');
const crackFilter = document.getElementById('crack-displace');
const outline = document.getElementById('card-outline');

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouse = { x: mouse.x, y: mouse.y };
let cardPos = { x: 0, y: 0 };
let cardVel = { x: 0, y: 0 };
let isDragging = false, dragOffset = { x: 0, y: 0 };
let moveDist = 0, clickCount = 0;
let shards = [];

// --- 1. DATE & TIME ENGINE ---
function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('date');
    const clockEl = document.getElementById('clock');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB');
    if (clockEl) clockEl.textContent = now.toLocaleTimeString([], { hour12: false });
}
setInterval(updateDateTime, 1000);
updateDateTime();

// --- 2. INITIALIZATION ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (card && cardPos.x === 0 && cardPos.y === 0) {
        const rect = card.getBoundingClientRect();
        cardPos.x = (window.innerWidth / 2) - (rect.width / 2);
        cardPos.y = (window.innerHeight / 2) - (rect.height / 2);
    }
}
window.addEventListener('resize', resize);
window.addEventListener('load', resize);
resize();

window.addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (cursor) { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; }
});

// --- 3. CARD INTERACTION ---
if (card) {
    card.addEventListener('mousedown', e => {
        if (e.target.closest('.mag-button')) return;
        e.preventDefault();
        isDragging = true;
        moveDist = 0;
        dragOffset.x = e.clientX - cardPos.x;
        dragOffset.y = e.clientY - cardPos.y;
    });

    window.addEventListener('mousemove', () => { if (isDragging) moveDist += 1; });

    window.addEventListener('mouseup', () => {
        if (isDragging && moveDist < 8) {
            clickCount++;
            if (crackFilter) {
                crackFilter.setAttribute('scale', clickCount * 22);
                card.style.filter = `url(#crack-filter)`;
            }
            if (clickCount >= 5) shatter();
        }
        isDragging = false;
    });
}

// --- 4. FUNCTIONAL SHATTER & SNAP SYSTEM ---
function shatter() {
    if (!card) return;
    const rect = card.getBoundingClientRect();
    
    // Position and show the Ghost Outline
    outline.style.width = `${rect.width}px`;
    outline.style.height = `${rect.height}px`;
    outline.style.left = `${cardPos.x}px`;
    outline.style.top = `${cardPos.y}px`;
    outline.style.display = 'block';

    card.style.display = 'none';
    shards = [];
    shatterContainer.innerHTML = '';

    const rows = 4, cols = 4;
    const sWidth = rect.width / cols;
    const sHeight = rect.height / rows;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const s = document.createElement('div');
            s.className = 'shard';
            s.style.width = `${sWidth}px`;
            s.style.height = `${sHeight}px`;
            
            const homeX = c * sWidth;
            const homeY = r * sHeight;
            const startX = rect.left + homeX;
            const startY = rect.top + homeY;
            
            shatterContainer.appendChild(s);

            const shardObj = {
                el: s, x: startX, y: startY,
                homeX: homeX, homeY: homeY,
                vx: (Math.random() - 0.5) * 30,
                vy: (Math.random() - 0.5) * 30,
                w: sWidth, h: sHeight,
                isBeingDragged: false,
                isSnapped: false,
                dragOff: { x: 0, y: 0 }
            };

            s.addEventListener('mousedown', e => {
                e.preventDefault();
                shardObj.isBeingDragged = true;
                shardObj.isSnapped = false;
                s.classList.remove('snapped');
                shardObj.dragOff.x = e.clientX - shardObj.x;
                shardObj.dragOff.y = e.clientY - shardObj.y;
            });

            shards.push(shardObj);
        }
    }
}

// --- 5. GLOBAL PHYSICS ENGINE ---
function updatePhysics() {
    // Card Physics
    if (card && card.style.display !== 'none') {
        if (isDragging) {
            cardVel.x = mouse.x - lastMouse.x;
            cardVel.y = mouse.y - lastMouse.y;
            cardPos.x = mouse.x - dragOffset.x;
            cardPos.y = mouse.y - dragOffset.y;
        } else {
            cardPos.x += cardVel.x; cardPos.y += cardVel.y;
            cardVel.x *= 0.97; cardVel.y *= 0.97;
            const rect = card.getBoundingClientRect();
            if (cardPos.x < 0) { cardPos.x = 0; cardVel.x *= -0.7; }
            if (cardPos.x + rect.width > window.innerWidth) { cardPos.x = window.innerWidth - rect.width; cardVel.x *= -0.7; }
            if (cardPos.y < 0) { cardPos.y = 0; cardVel.y *= -0.7; }
            if (cardPos.y + rect.height > window.innerHeight) { cardPos.y = window.innerHeight - rect.height; cardVel.y *= -0.7; }
        }
        card.style.left = `${cardPos.x}px`;
        card.style.top = `${cardPos.y}px`;
    }

    // Shard Physics + Snapping
    shards.forEach(s => {
        if (s.isSnapped) return;

        if (s.isBeingDragged) {
            s.vx = mouse.x - lastMouse.x;
            s.vy = mouse.y - lastMouse.y;
            s.x = mouse.x - s.dragOff.x;
            s.y = mouse.y - s.dragOff.y;

            // SNAP CHECK
            const targetX = cardPos.x + s.homeX;
            const targetY = cardPos.y + s.homeY;
            if (Math.hypot(s.x - targetX, s.y - targetY) < 25) {
                s.x = targetX; s.y = targetY;
                s.vx = 0; s.vy = 0;
                s.isSnapped = true; s.isBeingDragged = false;
                s.el.classList.add('snapped');
                
                // Heal Check
                if (shards.every(piece => piece.isSnapped)) {
                    setTimeout(() => {
                        card.style.display = 'block';
                        card.style.filter = 'none';
                        clickCount = 0;
                        outline.style.display = 'none';
                        shatterContainer.innerHTML = '';
                        shards = [];
                        if (crackFilter) crackFilter.setAttribute('scale', 0);
                    }, 500);
                }
            }
        } else {
            s.vy += 0.6; // Gravity
            s.x += s.vx; s.y += s.vy;
            s.vx *= 0.98; s.vy *= 0.98;
            if (s.y + s.h > window.innerHeight) { s.y = window.innerHeight - s.h; s.vy *= -0.4; }
            if (s.x < 0 || s.x + s.w > window.innerWidth) s.vx *= -0.6;
        }
        s.el.style.left = `${s.x}px`;
        s.el.style.top = `${s.y}px`;
    });

    lastMouse.x = mouse.x; lastMouse.y = mouse.y;
    requestAnimationFrame(updatePhysics);
}

// --- 6. BUBBLE ENGINE ---
class Bubble {
    constructor() { this.init(); }
    init() { 
        this.x = Math.random() * canvas.width; 
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 15 + 8; 
        this.vx = (Math.random() - 0.5) * 1.2; 
        this.vy = (Math.random() - 0.5) * 1.2; 
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        if (Math.hypot(mouse.x - this.x, mouse.y - this.y) < this.size + 12) this.init();
    }
    draw() {
        ctx.save(); ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(this.x - this.size*0.3, this.y - this.size*0.3, this.size*0.1, this.x, this.y, this.size);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; ctx.stroke(); ctx.restore();
    }
}

const bubbles = Array.from({ length: 30 }, () => new Bubble());
function loop() { 
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    bubbles.forEach(b => { b.update(); b.draw(); }); 
    requestAnimationFrame(loop); 
}
loop();
updatePhysics();
window.addEventListener('mouseup', () => shards.forEach(sh => sh.isBeingDragged = false));
