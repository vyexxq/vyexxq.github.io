const card = document.getElementById('tilt-card');
const buttons = document.querySelectorAll('.mag-button');
const canvas = document.getElementById('bubbleCanvas');
const ctx = canvas.getContext('2d');

let mouse = { x: -1000, y: -1000 };
window.addEventListener('mousemove', e => { 
    mouse.x = e.clientX; 
    mouse.y = e.clientY; 
});

// Tilt Logic
card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
});

card.addEventListener('mouseleave', () => {
    card.style.transform = `rotateY(0deg) rotateX(0deg)`;
});

// Magnet Logic
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

// Bubble Logic
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let particles = [];

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