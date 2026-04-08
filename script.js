const card = document.getElementById('tilt-card');
const buttons = document.querySelectorAll('.mag-button');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let mouse = { x: -1000, y: -1000 };
let ripples = [];
let particles = [];

window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY; 
});

// --- 1. SYSTEM CLOCK (Fix: Added padStart for stability) ---
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
}
setInterval(updateClock, 1000);
updateClock();

// --- 2. CLICK RIPPLE (Xbox 360 Warp Effect) ---
window.addEventListener('mousedown', e => {
    ripples.push(new Ripple(e.clientX, e.clientY));
});

class Ripple {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 0;
        this.life = 1.0;
    }
    draw() {
        this.r += 5; 
        this.life -= 0.02;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.life * 0.3})`;
        ctx.lineWidth = 15; 
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r - 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.life * 0.1})`;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// --- 3. TILT EFFECT ---
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

// --- 4. MAGNETIC BUTTONS ---
buttons.forEach(btn => {
    let bx = 0, by = 0, vx = 0, vy = 0; 
    function animate() {
        const rect = btn.getBoundingClientRect();
        const cX = rect.left + rect.width / 2;
        const cY = rect.top + rect.height / 2;
        const dist = Math.hypot(mouse.x - cX, mouse.y - cY);
        let tx = 0, ty = 0;
        if (dist < 70) { 
            tx = (mouse.x - cX) * 0.45;
            ty = (mouse.y - cY) * 0.45;
        }
        vx += (tx - bx) * 0.2; vy += (ty - by) * 0.2;
        vx *= 0.7; vy *= 0.7;
        bx += vx; by += vy;
        btn.style.transform = `translate(${bx}px, ${by}px)`;
        requestAnimationFrame(animate);
    }
    animate();
});

// --- 5. BUBBLE LOGIC & MAIN LOOP ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Bubble {
    constructor() { this.init(); }
    init() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 18 + 8;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
    }
    draw() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        if (Math.hypot(mouse.x - this.x, mouse.y - this.y) < this.size) this.pop();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(this.x - this.size/3, this.y - this.size/3, 1, this.x, this.y, this.size);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.4)"); 
        grad.addColorStop(0.7, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();
    }
    pop() {
        for(let i=0; i<6; i++) particles.push({ x: this.x, y: this.y, vx: (Math.random()-0.5)*4, vy: (Math.random()-0.5)*4, l: 1 });
        this.init();
    }
}

const bubbles = Array.from({length: 20}, () => new Bubble());

function mainLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ripples.forEach((r, i) => {
        r.draw();
        if(r.life <= 0) ripples.splice(i, 1);
    });

    bubbles.forEach(b => b.draw());

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.l -= 0.05;
        ctx.fillStyle = `rgba(255,255,255,${p.l})`;
        ctx.fillRect(p.x, p.y, 2, 2);
        if(p.l <= 0) particles.splice(i, 1);
    });

    requestAnimationFrame(mainLoop);
}
mainLoop();
