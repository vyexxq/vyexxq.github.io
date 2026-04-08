const card = document.getElementById('tilt-card');
const cursor = document.getElementById('custom-cursor');
const shatterContainer = document.getElementById('shatter-container');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let mouse = { x: window.innerWidth/2, y: window.innerHeight/2 };
let cardPos = { x: window.innerWidth/2 - 240, y: window.innerHeight/2 - 200 };
let cardVel = { x: 0, y: 0 };
let isDragging = false, dragOffset = { x: 0, y: 0 }, lastMouse = { x: 0, y: 0 };
let moveDist = 0, clickCount = 0;

// --- 1. MOUSE & CURSOR ---
window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; mouse.y = e.clientY; 
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
});

// --- 2. CLICK & DRAG LOGIC ---
card.addEventListener('mousedown', e => {
    isDragging = true;
    moveDist = 0; // Reset movement tracker
    dragOffset.x = e.clientX - cardPos.x;
    dragOffset.y = e.clientY - cardPos.y;
});

window.addEventListener('mousemove', () => { if(isDragging) moveDist += 1; });

window.addEventListener('mouseup', () => {
    if (isDragging && moveDist < 5) { // It was a click, not a drag
        handleDamage();
    }
    isDragging = false;
});

function handleDamage() {
    clickCount++;
    card.style.filter = `url(#crack-filter) blur(${clickCount * 0.5}px)`;
    card.style.opacity = 1 - (clickCount * 0.1);
    
    if (clickCount >= 5) {
        shatter();
    }
}

function shatter() {
    const rect = card.getBoundingClientRect();
    card.style.display = 'none';

    for (let i = 0; i < 15; i++) {
        const s = document.createElement('div');
        s.className = 'shard';
        const size = Math.random() * 80 + 40;
        s.style.width = `${size}px`;
        s.style.height = `${size}px`;
        s.style.left = `${rect.left + Math.random() * rect.width}px`;
        s.style.top = `${rect.top + Math.random() * rect.height}px`;
        
        // Random Shard Shape
        const p = `${Math.random()*100}% ${Math.random()*100}%, ${Math.random()*100}% ${Math.random()*100}%, ${Math.random()*100}% ${Math.random()*100}%`;
        s.style.clipPath = `polygon(${p})`;
        
        shatterContainer.appendChild(s);
        makeShardPhysics(s);
    }
}

// --- 3. PHYSICS ENGINE (Card & Shards) ---
function makeShardPhysics(el) {
    let pos = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    let vel = { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 };
    let drag = false, off = {x:0, y:0};

    el.addEventListener('mousedown', e => { drag = true; off.x = e.clientX - pos.x; off.y = e.clientY - pos.y; });
    window.addEventListener('mouseup', () => drag = false);

    function update() {
        if (drag) {
            vel.x = mouse.x - lastMouse.x; vel.y = mouse.y - lastMouse.y;
            pos.x = mouse.x - off.x; pos.y = mouse.y - off.y;
        } else {
            vel.y += 0.5; // Gravity
            pos.x += vel.x; pos.y += vel.y;
            vel.x *= 0.99; vel.y *= 0.99; // Friction

            if (pos.y + el.offsetHeight > window.innerHeight) {
                pos.y = window.innerHeight - el.offsetHeight;
                vel.y *= -0.4; // Bounce
            }
            if (pos.x < 0 || pos.x + el.offsetWidth > window.innerWidth) vel.x *= -0.6;
        }
        el.style.left = `${pos.x}px`; el.style.top = `${pos.y}px`;
        requestAnimationFrame(update);
    }
    update();
}

function applyCardPhysics() {
    if (isDragging) {
        cardVel.x = mouse.x - lastMouse.x; cardVel.y = mouse.y - lastMouse.y;
        cardPos.x = mouse.x - dragOffset.x; cardPos.y = mouse.y - dragOffset.y;
    } else {
        cardPos.x += cardVel.x; cardPos.y += cardVel.y;
        cardVel.x *= 0.98; cardVel.y *= 0.98;
        const rect = card.getBoundingClientRect();
        if (cardPos.x <= 0 || cardPos.x + rect.width >= window.innerWidth) cardVel.x *= -0.7;
        if (cardPos.y <= 0 || cardPos.y + rect.height >= window.innerHeight) cardVel.y *= -0.7;
    }
    card.style.left = `${cardPos.x}px`; card.style.top = `${cardPos.y}px`;
    lastMouse.x = mouse.x; lastMouse.y = mouse.y;
    requestAnimationFrame(applyCardPhysics);
}
applyCardPhysics();

// --- 4. CLOCK & BUBBLES ---
setInterval(() => {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString([], {hour12:false});
}, 1000);

canvas.width = window.innerWidth; canvas.height = window.innerHeight;
class Bubble {
    constructor() { this.init(); }
    init() { this.x = Math.random()*canvas.width; this.y = Math.random()*canvas.height; this.size = Math.random()*15+5; this.vx = (Math.random()-0.5); this.vy = (Math.random()-0.5); }
    draw() {
        this.x += this.vx; this.y += this.vy;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.fill();
    }
}
const bubbles = Array.from({length: 20}, () => new Bubble());
function loop() { ctx.clearRect(0,0,canvas.width,canvas.height); bubbles.forEach(b => b.draw()); requestAnimationFrame(loop); }
loop();
