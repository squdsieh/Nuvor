(function () {
    'use strict';

    // --- Performance Tier Detection ---
    const isMobile = window.innerWidth <= 768;
    const tier = isMobile ? 1 : 2;

    const heroSection = document.getElementById('hero');
    const canvasEl = document.getElementById('hero-canvas');
    if (!heroSection || !canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    heroSection.classList.add('has-3d');

    // --- Config per tier ---
    const PARTICLE_COUNT = tier === 2 ? 10000 : 3000;
    const BASE_SIZE = tier === 2 ? 1.6 : 1.8;
    const MOUSE_ENABLED = tier === 2;
    const DPR = Math.min(window.devicePixelRatio || 1, tier === 2 ? 2 : 1);

    // --- Sizing ---
    let W, H, scale;
    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvasEl.width = W * DPR;
        canvasEl.height = H * DPR;
        canvasEl.style.width = W + 'px';
        canvasEl.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        // Scale factor: map car coordinates (-20..+16 X, -6..+5 Y) to screen
        scale = Math.min(W / 50, H / 18);
    }
    resize();
    window.addEventListener('resize', resize);

    // --- Car silhouette control points (sports car side profile) ---
    const carOutline = [
        [-18, -4], [-16, -4.5], [-14, -4.8], [-12, -5],
        [-11, -5], [-10.5, -3.5], [-9, -3], [-7.5, -3.5], [-7, -5],
        [-6, -5], [-4, -5], [-2, -5], [0, -5], [2, -5], [4, -5],
        [5, -5], [5.5, -3.5], [7, -3], [8.5, -3.5], [9, -5],
        [10, -5], [12, -4.8], [14, -4.5],
        [14, -4], [14.5, -3], [15, -2], [15, -1], [14.8, 0],
        [14, 0.5], [13, 1.5], [11, 2.5], [9, 3.2], [7, 3.8],
        [5, 4], [3, 4.1], [1, 4.1], [-1, 4], [-3, 3.8],
        [-5, 3.5], [-7, 2.5], [-9, 1],
        [-10, 0.2], [-12, -0.5], [-14, -1], [-16, -1.5], [-18, -2],
        [-18, -2.5], [-18.5, -3], [-18.5, -3.5], [-18, -4],
    ];

    // --- Generate target positions from car silhouette ---
    function generateCarPoints(count) {
        var points = [];

        // 1. Edge points (40%)
        var edgeCount = Math.floor(count * 0.4);
        for (var i = 0; i < edgeCount; i++) {
            var t = i / edgeCount;
            var idx = t * (carOutline.length - 1);
            var i0 = Math.floor(idx);
            var i1 = Math.min(i0 + 1, carOutline.length - 1);
            var frac = idx - i0;
            var x = carOutline[i0][0] * (1 - frac) + carOutline[i1][0] * frac;
            var y = carOutline[i0][1] * (1 - frac) + carOutline[i1][1] * frac;
            points.push({
                tx: x + (Math.random() - 0.5) * 0.4,
                ty: y + (Math.random() - 0.5) * 0.4,
                depth: (Math.random() - 0.5) * 1.5
            });
        }

        // 2. Fill points (50%)
        var fillCount = Math.floor(count * 0.5);
        for (var i = 0; i < fillCount; i++) {
            var x = -18 + Math.random() * 33;
            var yMin = -4.5, yMax = 0;
            if (x < -10) {
                yMin = -4; yMax = -0.5 + (x + 18) * 0.2;
            } else if (x < -7) {
                yMin = -2; yMax = 1 + (x + 10) * 0.5;
            } else if (x < 5) {
                yMin = -4.5; yMax = 3.5 + (x + 7) * 0.05;
            } else if (x < 9) {
                yMin = -2; yMax = 3.5;
            } else {
                yMin = -4; yMax = 2.5 - (x - 9) * 0.4;
            }
            var y = yMin + Math.random() * (yMax - yMin);
            points.push({
                tx: x + (Math.random() - 0.5) * 0.3,
                ty: y + (Math.random() - 0.5) * 0.3,
                depth: (Math.random() - 0.5) * 1.2
            });
        }

        // 3. Detail points (10%) — wheels, headlights, taillights
        var detailCount = count - edgeCount - fillCount;
        var detailAreas = [
            { cx: -9, cy: -3, r: 2.2 },
            { cx: 7, cy: -3, r: 2.2 },
            { cx: -18, cy: -2.5, r: 1.5 },
            { cx: 14.5, cy: -1, r: 1.5 },
        ];
        for (var i = 0; i < detailCount; i++) {
            var area = detailAreas[i % detailAreas.length];
            var angle = Math.random() * Math.PI * 2;
            var dist = Math.random() * area.r;
            points.push({
                tx: area.cx + Math.cos(angle) * dist,
                ty: area.cy + Math.sin(angle) * dist,
                depth: (Math.random() - 0.5) * 1.0
            });
        }

        return points;
    }

    // --- Build particles ---
    var carPoints = generateCarPoints(PARTICLE_COUNT);
    var particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
        var cp = carPoints[i];
        particles.push({
            // Current position
            x: (Math.random() - 0.5) * 60,
            y: (Math.random() - 0.5) * 40,
            // Random (scattered) position
            rx: (Math.random() - 0.5) * 60,
            ry: (Math.random() - 0.5) * 40,
            // Target (car shape) position
            tx: cp.tx,
            ty: cp.ty,
            // Depth for size variation
            depth: cp.depth,
            // Color (r, g, b) — cool gray-white base
            cr: 0.65 + Math.random() * 0.2,
            cg: 0.65 + Math.random() * 0.2,
            cb: 0.7 + Math.random() * 0.15,
            // Base color backup
            br: 0, bg: 0, bb: 0,
            // Animation offset
            offset: Math.random() * Math.PI * 2,
            // Size multiplier
            size: 0.7 + Math.random() * 0.6,
        });
        // Store base color
        particles[i].br = particles[i].cr;
        particles[i].bg = particles[i].cg;
        particles[i].bb = particles[i].cb;
    }

    // --- Mouse tracking ---
    var mouse = { x: 0, y: 0 };
    if (MOUSE_ENABLED) {
        window.addEventListener('mousemove', function (e) {
            // Convert screen coords to car-coordinate space
            mouse.x = (e.clientX - W / 2) / scale;
            mouse.y = (e.clientY - H / 2.3) / scale;
        });
    }

    // --- State ---
    var isForming = false;
    var formProgress = 0;
    var isVisible = true;
    var animationId = null;

    // Listen for preloader done
    window.addEventListener('hero-reveal', function () {
        isForming = true;
    });

    // Scroll visibility — pause when off-screen
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            isVisible = entries[0].isIntersecting;
            if (isVisible && !animationId) animationId = requestAnimationFrame(animate);
        }, { threshold: 0.05 });
        observer.observe(heroSection);
    }

    // --- Grid drawing helper ---
    function drawGrid(t) {
        var cx = W / 2;
        var cy = H / 2.3 + 6.5 * scale; // Below car
        var gridW = 42 * scale;
        var gridH = 8 * scale;
        var cols = 30;
        var rows = 6;

        ctx.save();
        ctx.globalAlpha = 0.04;
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = 0.5;

        // Perspective-ish grid (simple vertical compression toward horizon)
        for (var r = 0; r <= rows; r++) {
            var ry = r / rows;
            var perspScale = 0.4 + ry * 0.6;
            var lineY = cy + ry * gridH;
            var halfW = (gridW / 2) * perspScale;
            ctx.beginPath();
            ctx.moveTo(cx - halfW, lineY);
            ctx.lineTo(cx + halfW, lineY);
            ctx.stroke();
        }
        for (var c = 0; c <= cols; c++) {
            var cx2 = (c / cols - 0.5);
            ctx.beginPath();
            ctx.moveTo(W / 2 + cx2 * gridW * 0.4, cy);
            ctx.lineTo(W / 2 + cx2 * gridW, cy + gridH);
            ctx.stroke();
        }
        ctx.restore();
    }

    // --- Color sweep constants ---
    var RED_R = 0.545, RED_G = 0.0, RED_B = 0.0; // #8b0000
    var WAVE_SPEED = 0.15;
    var WAVE_WIDTH = 8;
    var CAR_MIN_X = -19;
    var CAR_SPAN = 35; // -19 to +16

    // --- Animation Loop ---
    function animate(time) {
        if (!isVisible) {
            animationId = null;
            return;
        }
        animationId = requestAnimationFrame(animate);

        var t = time * 0.001;

        // Formation progress
        if (isForming && formProgress < 1) {
            formProgress = Math.min(1, formProgress + 0.006);
        }
        var ease = formProgress * formProgress * (3 - 2 * formProgress);

        // Clear
        ctx.clearRect(0, 0, W, H);

        // Draw grid floor
        if (ease > 0.3) {
            ctx.globalAlpha = (ease - 0.3) / 0.7;
            drawGrid(t);
            ctx.globalAlpha = 1;
        }

        // Center offset for car rendering
        var cx = W / 2;
        var cy = H / 2.3;

        // Wave position for color sweep
        var wavePos = ((t * WAVE_SPEED) % 1.4 - 0.2) * CAR_SPAN + CAR_MIN_X;

        // Composite mode for glow effect
        ctx.globalCompositeOperation = 'lighter';

        // Draw particles
        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var p = particles[i];
            var offset = p.offset;

            // Lerp position
            var px = p.rx + (p.tx - p.rx) * ease;
            var py = p.ry + (p.ty - p.ry) * ease;

            // Breathing oscillation
            if (ease > 0.5) {
                var breathe = (ease - 0.5) * 2;
                px += Math.sin(t * 0.8 + offset) * 0.15 * breathe;
                py += Math.cos(t * 0.6 + offset * 1.3) * 0.12 * breathe;
            }

            // Scattered drift
            if (ease < 1) {
                var drift = 1 - ease;
                px += Math.sin(t * 0.3 + offset) * 0.5 * drift;
                py += Math.cos(t * 0.2 + offset * 1.5) * 0.4 * drift;
            }

            // Mouse repulsion
            if (MOUSE_ENABLED && ease > 0.3) {
                var dx = px - mouse.x;
                var dy = py - mouse.y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 5 && dist > 0.01) {
                    var force = (1 - dist / 5) * 2.5 * ease;
                    px += (dx / dist) * force;
                    py += (dy / dist) * force;
                }
            }

            p.x = px;
            p.y = py;

            // Color sweep
            var cr = p.br, cg = p.bg, cb = p.bb;
            if (ease > 0.7) {
                var distFromWave = Math.abs(p.tx - wavePos);
                if (distFromWave < WAVE_WIDTH) {
                    var intensity = (1 - distFromWave / WAVE_WIDTH) * ((ease - 0.7) / 0.3);
                    var si = intensity * intensity * (3 - 2 * intensity);
                    cr = p.br + (RED_R - p.br) * si;
                    cg = p.bg + (RED_G - p.bg) * si;
                    cb = p.bb + (RED_B - p.bb) * si;
                }
            }

            // Convert to screen coords
            var depthFactor = 1 + p.depth * 0.05;
            var sx = cx + px * scale * depthFactor;
            var sy = cy + py * scale * depthFactor;
            var sz = BASE_SIZE * p.size * (1 + p.depth * 0.1);

            // Alpha based on depth and formation
            var alpha = (0.3 + ease * 0.5) * (0.6 + p.size * 0.4);

            // Draw particle as a soft glowing dot
            var r255 = Math.round(cr * 255);
            var g255 = Math.round(cg * 255);
            var b255 = Math.round(cb * 255);

            ctx.beginPath();
            ctx.arc(sx, sy, sz, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',' + (alpha * 0.7) + ')';
            ctx.fill();

            // Glow layer for brighter particles (every 3rd for performance)
            if (i % 3 === 0) {
                ctx.beginPath();
                ctx.arc(sx, sy, sz * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',' + (alpha * 0.08) + ')';
                ctx.fill();
            }
        }

        ctx.globalCompositeOperation = 'source-over';
    }

    // Start animation
    animationId = requestAnimationFrame(animate);
})();
