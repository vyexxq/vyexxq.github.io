const card = document.getElementById('tilt-card');
const buttons = document.querySelectorAll('.mag-button');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let mouse = { x: -1000, y: -1000 };
let ripples = [];
let particles = [];
let bubbles = [];

window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY; 
});

// --- 1. SYSTEM CLOCK ---
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        clockElement.textContent = `${h}:${m}:${s}`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. XBOX 360 STYLE RIPPLE ---
window.addEventListener('mousedown', e => {
    ripples.push({
        x: e.clientX,
        y: e.clientY,
        r: 0,
        life: 1.0
    });
});

function drawRipples() {
    ctx.save(); // Isolate styles
    for (let i = ripples.length - 1; i >= 0; i--) {
        let r = ripples[i];
        r.r += 8; // Faster expansion for better feel
        r.life -= 0.02;

        if (r.life <= 0) {
            ripples.splice(i, 1);
            continue;
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.life * 0.25})`;
        ctx.lineWidth = 15;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.life * 0.08})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore(); // Reset styles so bubbles aren't affected
}

// --- 3. INTERACTION ---
if (card) {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    });
    card.addEventListener('mouseleave', () => {
        card.style.transform = `rotateY(0deg) rotateX(0deg)`;
    });
}

buttons.forEach(btn => {
    let bx = 0, by = 0, vx = 0, vy = 0; 
    function animateBtn() {
        const rect = btn.getBoundingClientRect();
        const cX = rect.left + rect.width / 2;
        const cY = rect.top + rect.height / 2;
        const dist = Math.hypot(mouse.x - cX, mouse.y - cY);
        let tx = 0, ty = 0;
        if (dist < 100) { 
            tx = (mouse.x - cX) * 0.4;
            ty = (mouse.y - cY) * 0.4;
        }
        vx += (tx - bx) * 0.15; vy += (ty - by) * 0.15;
        vx *= 0.8; vy *= 0.8;
        bx += vx; by += vy;
        btn.style.transform = `translate(${bx}px, ${by}px)`;
        requestAnimationFrame(animateBtn);
    }
    animateBtn();
});

// --- 4. BUBBLES ---
class Bubble {
    constructor() { this.init(); }
    init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 15 + 5;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        if (Math.hypot(mouse.x - this.x, mouse.y - this.y) < this.size) this.pop();
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(this.x-this.size/3, this.y-this.size/3, 1, this.x, this.y, this.size);
        g.addColorStop(0, "rgba(255,255,255,0.3)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    pop() {
        for(let i=0; i<5; i++) particles.push({ x: this.x, y: this.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, l:1 });
        this.init();
    }
}

function initBubbles() {
    bubbles = Array.from({length: 30}, () => new Bubble());
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initBubbles();
}
window.addEventListener('resize', resize);
resize();

// --- 5. MAIN LOOP ---
function main() {
    // Clear canvas entirely every frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Ripples (Behind bubbles)
    drawRipples();

    // 2. Draw Bubbles
    bubbles.forEach(b => {
        b.update();
        b.draw();
    });

    // 3. Draw Particles (Top layer)
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy; p.l -= 0.03;
        if (p.l <= 0) {
            particles.splice(i, 1);
            continue;
        }
        ctx.fillStyle = `rgba(255,255,255,${p.l})`;
        ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.restore();

    requestAnimationFrame(main);
}
main();
