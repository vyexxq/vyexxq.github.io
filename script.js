/**
 * vyexx - Global Interaction Engine
 * Features: Aero Cursor, Physics-based Draggable Card, 
 * Crack/Shatter System, Gravity Shards, and Bubble Pop.
 */

const card = document.getElementById('tilt-card');
const cursor = document.getElementById('custom-cursor');
const shatterContainer = document.getElementById('shatter-container');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');
const crackFilter = document.getElementById('crack-displace');

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lastMouse = { x: mouse.x, y: mouse.y };
let cardPos = { x: 0, y: 0 };
let cardVel = { x: 0, y: 0 };
let isDragging = false, dragOffset = { x: 0, y: 0 };
let moveDist = 0, clickCount = 0;
let shards = [];

// --- 1. INITIALIZATION & RESIZING ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Recenter card if it's the first load
    if (card && cardPos.x === 0 && cardPos.y === 0) {
        const rect = card.getBoundingClientRect();
        cardPos.x = (window.innerWidth / 2) - (rect.width / 2);
        cardPos.y = (window.innerHeight / 2) - (rect.height / 2);
    }
}
window.addEventListener('resize', resize);
window.addEventListener('load', resize);
resize();

// --- 2. MOUSE TRACKING ---
window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (cursor) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    }
});

// --- 3. CARD INTERACTION (DRAG & CRACK) ---
if (card) {
    card.addEventListener('mousedown', e => {
        // Allow clicks on links/buttons to pass through
        if (e.target.closest('.mag-button') || e.target.tagName === 'IFRAME') return;
        
        e.preventDefault();
        isDragging = true;
        moveDist = 0;
        dragOffset.x = e.clientX - cardPos.x;
        dragOffset.y = e.clientY - cardPos.y;
    });

    window.addEventListener('mousemove', () => { if (isDragging) moveDist += 1; });

    window.addEventListener('mouseup', () => {
        // If movement was very low, count it as a damage click
        if (isDragging && moveDist < 8) {
            clickCount++;
            if (crackFilter) {
                // Increase SVG displacement intensity
                crackFilter.setAttribute('scale', clickCount * 22);
                card.style.filter = `url(#crack-filter)`;
            }
            if (clickCount >= 5) shatter();
        }
        isDragging = false;
    });
}

// --- 4. SHATTER SYSTEM ---
function shatter() {
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.display = 'none';

    for (let i = 0; i < 15; i++) {
        const s = document.createElement('div');
        s.className = 'shard';
        const size = Math.random() * 100 + 50;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        
        const startX = rect.left + Math.random() * (rect.width - size);
        const startY = rect.top + Math.random() * (rect.height - size);
        
        // Random polygon shapes for shards
        const p = `${Math.random()*100}% ${Math.random()*100}%, ${Math.random()*100}% ${Math.random()*100}%, ${Math.random()*100}% ${Math.random()*100}%`;
        s.style.clipPath = `polygon(${p})`;
        
        if (shatterContainer) shatterContainer.appendChild(s);
        
        shards.push({
            el: s, x: startX, y: startY,
            vx: (Math.random() - 0.5) * 40, 
            vy: (Math.random() - 0.5) * 40,
            w: size, h: size,
            isBeingDragged: false,
            dragOff: { x: 0, y: 0 }
        });

        s.addEventListener('mousedown', e => {
            e.preventDefault();
            const shard = shards.find(sh => sh.el === s);
            shard.isBeingDragged = true;
            shard.dragOff.x = e.clientX - shard.x;
            shard.dragOff.y = e.clientY - shard.y;
        });
    }
    window.addEventListener('mouseup', () => {
        shards.forEach(sh => sh.isBeingDragged = false);
    });
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
            cardPos.x += cardVel.x; 
            cardPos.y += cardVel.y;
            cardVel.x *= 0.97; // Friction
            cardVel.y *= 0.97;

            const rect = card.getBoundingClientRect();
            // Edge Bouncing
            if (cardPos.x < 0) { cardPos.x = 0; cardVel.x *= -0.7; }
            if (cardPos.x + rect.width > window.innerWidth) { cardPos.x = window.innerWidth - rect.width; cardVel.x *= -0.7; }
            if (cardPos.y < 0) { cardPos.y = 0; cardVel.y *= -0.7; }
            if (cardPos.y + rect.height > window.innerHeight) { cardPos.y = window.innerHeight - rect.height; cardVel.y *= -0.7; }
        }
        card.style.left = `${cardPos.x}px`;
        card.style.top = `${cardPos.y}px`;
    }

    // Shard Physics (Gravity + Drag)
    shards.forEach(s => {
        if (s.isBeingDragged) {
            s.vx = mouse.x - lastMouse.x;
            s.vy = mouse.y - lastMouse.y;
            s.x = mouse.x - s.dragOff.x;
            s.y = mouse.y - s.dragOff.y;
        } else {
            s.vy += 0.6; // Gravity
            s.x += s.vx; 
            s.y += s.vy;
            s.vx *= 0.99; 
            s.vy *= 0.99;
            // Ground bounce
            if (s.y + s.h > window.innerHeight) { 
                s.y = window.innerHeight - s.h; 
                s.vy *= -0.45; 
                s.vx *= 0.9; 
            }
            // Wall bounce
            if (s.x < 0 || s.x + s.w > window.innerWidth) { s.vx *= -0.6; }
        }
        s.el.style.left = `${s.x}px`;
        s.el.style.top = `${s.y}px`;
    });

    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;
    requestAnimationFrame(updatePhysics);
}
updatePhysics();

// --- 6. BUBBLE ENGINE (POPPING RESTORED) ---
class Bubble {
    constructor() { this.init(); }
    init() { 
        this.x = Math.random() * canvas.width; 
        this.initY = Math.random() * canvas.height;
        this.y = this.initY;
        this.size = Math.random() * 15 + 8; 
        this.vx = (Math.random() - 0.5) * 1.2; 
        this.vy = (Math.random() - 0.5) * 1.2; 
    }
    update() {
        this.x += this.vx; 
        this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        // POP LOGIC: Calculate distance to mouse
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < this.size + 12) {
            this.init(); // "Pops" and resets elsewhere
        }
    }
    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(this.x - this.size*0.3, this.y - this.size*0.3, this.size*0.1, this.x, this.y, this.size);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)"; ctx.stroke();
        ctx.restore();
    }
}

const bubbles = Array.from({ length: 30 }, () => new Bubble());
function loop() { 
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    bubbles.forEach(b => { b.update(); b.draw(); }); 
    requestAnimationFrame(loop); 
}
loop();

// System Clock
const clockEl = document.getElementById('clock');
if (clockEl) setInterval(() => { 
    clockEl.textContent = new Date().toLocaleTimeString([], { hour12: false }); 
}, 1000);
