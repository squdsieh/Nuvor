(function () {
    'use strict';

    // --- Setup ---
    var isMobile = window.innerWidth <= 768;
    var tier = isMobile ? 1 : 2;
    var heroSection = document.getElementById('hero');
    var canvasEl = document.getElementById('hero-canvas');
    if (!heroSection || !canvasEl) return;
    var ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    heroSection.classList.add('has-3d');

    var PARTICLE_COUNT = tier === 2 ? 8000 : 2800;
    var BASE_SIZE = tier === 2 ? 1.6 : 1.8;
    var MOUSE_ENABLED = tier === 2;
    var DPR = Math.min(window.devicePixelRatio || 1, tier === 2 ? 2 : 1);
    var FOCAL = 40; // perspective focal length in car-coordinate units
    var TAU = Math.PI * 2;

    // --- Canvas sizing ---
    var W, H, scale;
    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvasEl.width = W * DPR;
        canvasEl.height = H * DPR;
        canvasEl.style.width = W + 'px';
        canvasEl.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        // Map car coords (≈50 wide, ≈17 tall) to screen
        scale = Math.min(W / 42, H / 14);
    }
    resize();
    window.addEventListener('resize', resize);

    // --- Car outlines (sports car side profile) ---
    // Multiple paths give the car structure (body silhouette + roof line + belt line)

    // Main body silhouette — continuous loop
    var carBody = [
        // Front bumper up to hood
        [-18.5, -1.5], [-18.5, -2.2], [-18.3, -2.8], [-17.8, -3.3], [-17, -3.4],
        // Hood sloping up to windshield
        [-15, -3.6], [-13, -3.9], [-11, -4.3], [-9, -4.7],
        // Windshield (steep rise)
        [-7.5, -5.3], [-5.5, -5.9], [-3, -6.1],
        // Roof line
        [0, -6.15], [3, -6.1],
        // Rear windshield (slopes down)
        [5.5, -5.7], [7.5, -5.0], [9, -4.3],
        // Trunk
        [11, -3.9], [13, -3.7], [14.5, -3.5],
        // Rear bumper down
        [15.2, -3.0], [15.4, -2.2], [15.3, -1.4], [15.0, -0.8],
        // Rear lower
        [14.5, -0.4], [13.5, -0.2],
        // Underbody to rear wheel
        [11, -0.15], [9.5, -0.2],
        // Rear wheel arch (dip up)
        [8.8, -0.6], [8.2, -1.8], [7, -2.4], [5.8, -1.8], [5.2, -0.6],
        // Rocker panel (between wheels)
        [4.5, -0.2], [2, 0.0], [-1, 0.05], [-4, 0.0], [-6, -0.2],
        // Front wheel arch (dip up)
        [-6.8, -0.6], [-7.6, -1.8], [-9, -2.4], [-10.4, -1.8], [-11, -0.6],
        // Front underbody
        [-12, -0.3], [-14, -0.2], [-16, -0.3], [-17.5, -0.6],
        // Close the path back to start
        [-18, -1.0], [-18.5, -1.5]
    ];

    // Belt line (door/body crease running through middle of car)
    var carBelt = [
        [-17, -2.3], [-14, -2.5], [-10, -2.9], [-6, -3.2],
        [-2, -3.3], [2, -3.3], [6, -3.2], [10, -3.0],
        [13, -2.9], [15, -2.6]
    ];

    // Combined outline for edge sampling (weighted toward body)
    var carOutline = carBody;

    // --- Generate 3D target positions ---
    // Z = car width axis. Z ≈ 0 is the visible side panel.
    // Positive Z = far side. Negative Z = near side (toward viewer at rest angle).
    function sampleAlongPath(path, t) {
        var idx = t * (path.length - 1);
        var i0 = Math.floor(idx);
        var i1 = Math.min(i0 + 1, path.length - 1);
        var frac = idx - i0;
        return {
            x: path[i0][0] * (1 - frac) + path[i1][0] * frac,
            y: path[i0][1] * (1 - frac) + path[i1][1] * frac
        };
    }

    function generateCarPoints(count) {
        var pts = [];
        var bodyCount   = Math.floor(count * 0.55); // main silhouette outline
        var beltCount   = Math.floor(count * 0.08); // door/body crease line
        var fillCount   = Math.floor(count * 0.12); // sparse body hint
        var detailCount = count - bodyCount - beltCount - fillCount;

        // Body silhouette (primary outline — crisp)
        for (var i = 0; i < bodyCount; i++) {
            var p = sampleAlongPath(carBody, i / bodyCount);
            pts.push({
                tx: p.x + (Math.random() - 0.5) * 0.18,
                ty: p.y + (Math.random() - 0.5) * 0.18,
                tz: (Math.random() - 0.5) * 0.2,
                ptype: 0
            });
        }

        // Belt line (door/body crease)
        for (var i = 0; i < beltCount; i++) {
            var p = sampleAlongPath(carBelt, i / beltCount);
            pts.push({
                tx: p.x + (Math.random() - 0.5) * 0.15,
                ty: p.y + (Math.random() - 0.5) * 0.15,
                tz: (Math.random() - 0.5) * 0.3,
                ptype: 0
            });
        }

        // Sparse body fill — only in actual body regions (NOT wheel wells)
        var i = 0;
        while (i < fillCount) {
            var x = -17.5 + Math.random() * 32.5;
            // Wheel well cutouts
            if (x > -11 && x < -7) continue;  // skip front wheel area
            if (x > 5 && x < 9) continue;      // skip rear wheel area
            var yMin, yMax;
            if (x < -11) { yMin = -3.4; yMax = -0.8; }                   // front fender
            else if (x < -3) { yMin = -5.9 + (x + 11) * 0.05; yMax = -0.3; } // hood→cabin
            else if (x < 3) { yMin = -6.1; yMax = -0.2; }                // cabin
            else if (x < 5) { yMin = -5.8 + (x - 3) * 0.4; yMax = -0.3; } // rear cabin slope
            else if (x < 9) { continue; }                                 // skip (wheel)
            else { yMin = -3.7; yMax = -0.5; }                            // trunk
            var y = yMin + Math.random() * (yMax - yMin);
            pts.push({
                tx: x + (Math.random() - 0.5) * 0.2,
                ty: y + (Math.random() - 0.5) * 0.2,
                tz: (Math.random() - 0.5) * 0.8,
                ptype: 0
            });
            i++;
        }

        // Detail: wheels as rings, headlights, taillights
        var detailGroups = [
            { cx: -9,    cy: -1.1, rMin: 1.0, rMax: 1.8, weight: 0.30, ptype: 0 }, // front wheel (rim)
            { cx:  7,    cy: -1.1, rMin: 1.0, rMax: 1.8, weight: 0.30, ptype: 0 }, // rear wheel (rim)
            { cx: -17.3, cy: -2.9, rMin: 0.0, rMax: 0.7, weight: 0.18, ptype: 1 }, // headlight
            { cx:  14.7, cy: -2.6, rMin: 0.0, rMax: 0.7, weight: 0.22, ptype: 2 }, // taillight
        ];
        var cum = [];
        var sum = 0;
        for (var g = 0; g < detailGroups.length; g++) { sum += detailGroups[g].weight; cum.push(sum); }
        for (var i = 0; i < detailCount; i++) {
            var r = Math.random() * sum;
            var gi = 0;
            while (gi < cum.length && r > cum[gi]) gi++;
            var g = detailGroups[gi];
            var angle = Math.random() * TAU;
            var dist = g.rMin + Math.random() * (g.rMax - g.rMin);
            pts.push({
                tx: g.cx + Math.cos(angle) * dist,
                ty: g.cy + Math.sin(angle) * dist,
                tz: (Math.random() - 0.5) * 0.3,
                ptype: g.ptype
            });
        }
        return pts;
    }

    var carPoints = generateCarPoints(PARTICLE_COUNT);

    // --- Build particles ---
    var particles = new Array(PARTICLE_COUNT);
    for (var i = 0; i < PARTICLE_COUNT; i++) {
        var cp = carPoints[i];
        // Metallic silver-white base: vary brightness by height (roof = brighter, floor = darker)
        var posLight = 0.58 + Math.max(0, -cp.ty / 6) * 0.28;
        var variation = Math.random() * 0.14 - 0.05;
        var br = Math.min(1.0, posLight + variation + 0.06);
        var bg = Math.min(1.0, posLight + variation);
        var bb = Math.min(1.0, posLight + variation + 0.04);
        particles[i] = {
            // Initial scatter position (3D, random)
            rx: (Math.random() - 0.5) * 55,
            ry: (Math.random() - 0.5) * 32,
            rz: (Math.random() - 0.5) * 28,
            // Target position (car shape, 3D)
            tx: cp.tx, ty: cp.ty, tz: cp.tz,
            ptype: cp.ptype,
            // Base color (metallic silver-white)
            br: br, bg: bg, bb: bb,
            offset: Math.random() * TAU,
            size: 0.65 + Math.random() * 0.65,
        };
    }

    // --- Mouse (initialized off-screen so no repulsion before movement) ---
    var mouse = { x: -99999, y: -99999 };
    if (MOUSE_ENABLED) {
        window.addEventListener('mousemove', function (e) {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        });
    }

    // --- State ---
    var isForming = false;
    var formProgress = 0;
    var isVisible = true;
    var rafId = null;

    window.addEventListener('hero-reveal', function () { isForming = true; });
    // Fallback: auto-start formation if preloader event never fires
    setTimeout(function () { isForming = true; }, 2200);

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            isVisible = entries[0].isIntersecting;
            if (isVisible && !rafId) rafId = requestAnimationFrame(animate);
        }, { threshold: 0.05 }).observe(heroSection);
    }

    // --- Precomputed per-frame rotation values ---
    var cosR = 1, sinR = 0;

    // Project a 3D point (X,Y,Z) → screen (sx,sy) with Y-axis rotation + perspective.
    // Uses precomputed cosR/sinR from current frame's rotation angle.
    function projectPoint(x, y, z) {
        var rx = x * cosR - z * sinR;
        var rz = x * sinR + z * cosR;
        var persp = FOCAL / (FOCAL + rz);
        return {
            sx: W * 0.5 + rx * scale * persp,
            sy: H * 0.56 + y * scale * persp,
            pz: rz,
            persp: persp
        };
    }

    // --- Perspective grid floor ---
    function drawGrid(alpha) {
        var cx = W / 2;
        var cy = H * 0.56 + 1.0 * scale;
        var gW = 46 * scale, gH = 8.5 * scale;
        var cols = 34, rows = 7;
        ctx.save();
        ctx.globalAlpha = alpha * 0.052;
        ctx.strokeStyle = '#8b0000';
        ctx.lineWidth = 0.6;
        for (var r = 0; r <= rows; r++) {
            var p = r / rows;
            var halfW = (gW / 2) * (0.28 + p * 0.72);
            var lineY = cy + p * gH;
            ctx.beginPath();
            ctx.moveTo(cx - halfW, lineY);
            ctx.lineTo(cx + halfW, lineY);
            ctx.stroke();
        }
        for (var c = 0; c <= cols; c++) {
            var cx2 = (c / cols - 0.5);
            ctx.beginPath();
            ctx.moveTo(W / 2 + cx2 * gW * 0.28, cy);
            ctx.lineTo(W / 2 + cx2 * gW, cy + gH);
            ctx.stroke();
        }
        ctx.restore();
    }

    // --- Cinematic light sweep (horizontal glare band) ---
    function drawLightSweep(t, ease) {
        if (ease < 0.78) return;
        var a = (ease - 0.78) / 0.22;
        // Sweep repeats every ~9 seconds
        var sweep = ((t * 0.11) % 2.8) - 0.4;
        if (sweep < 0 || sweep > 1) return;
        var carLeft = W * 0.5 - 18.5 * scale;
        var carRight = W * 0.5 + 15.5 * scale;
        var x = carLeft + sweep * (carRight - carLeft);
        var bw = scale * 5.0;
        var cy = H * 0.56;
        var grad = ctx.createLinearGradient(x - bw, 0, x + bw, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,246,228,' + (0.055 * a).toFixed(3) + ')');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(x - bw, cy - 8.5 * scale, bw * 2, 17 * scale);
        ctx.restore();
    }

    // --- Lens flares (headlight + taillight) ---
    function drawFlares(ease) {
        if (ease < 0.82) return;
        var a = (ease - 0.82) / 0.18;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        // Taillight — red/orange glow
        var tl = projectPoint(14.7, -2.6, 0.0);
        var tlg = ctx.createRadialGradient(tl.sx, tl.sy, 0, tl.sx, tl.sy, 3.0 * scale);
        tlg.addColorStop(0,   'rgba(255,80,15,' + (0.55 * a).toFixed(3) + ')');
        tlg.addColorStop(0.3, 'rgba(200,20,0,'  + (0.20 * a).toFixed(3) + ')');
        tlg.addColorStop(1,   'rgba(139,0,0,0)');
        ctx.fillStyle = tlg;
        ctx.beginPath();
        ctx.arc(tl.sx, tl.sy, 3.0 * scale, 0, TAU);
        ctx.fill();

        // Headlight — cool white/blue glow
        var hl = projectPoint(-17.3, -2.9, 0.0);
        var hlg = ctx.createRadialGradient(hl.sx, hl.sy, 0, hl.sx, hl.sy, 2.6 * scale);
        hlg.addColorStop(0,   'rgba(220,232,255,' + (0.50 * a).toFixed(3) + ')');
        hlg.addColorStop(0.4, 'rgba(140,172,255,' + (0.16 * a).toFixed(3) + ')');
        hlg.addColorStop(1,   'rgba(80,120,255,0)');
        ctx.fillStyle = hlg;
        ctx.beginPath();
        ctx.arc(hl.sx, hl.sy, 2.6 * scale, 0, TAU);
        ctx.fill();

        ctx.restore();
    }

    // --- Vignette (studio-render atmosphere) ---
    function drawVignette() {
        var grad = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.35, W * 0.5, H * 0.5, Math.max(W, H) * 0.85);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.38)');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // --- Color sweep ---
    var RED_R = 139, RED_G = 0, RED_B = 0;
    var WAVE_SPEED = 0.14;
    var WAVE_WIDTH = 9;
    var CAR_MIN_X = -18.5;
    var CAR_SPAN = 34;

    // --- Subtle 3D rotation during reveal, pure side view at rest ---
    var ROT_START = 0.10;  // ~6° — tiny front hint during formation
    var ROT_END   = 0.0;   // 0° — pure side profile (crisp silhouette)

    // --- Main loop ---
    function animate(ts) {
        if (!isVisible) { rafId = null; return; }
        rafId = requestAnimationFrame(animate);

        var t = ts * 0.001;

        if (isForming && formProgress < 1) {
            formProgress = Math.min(1, formProgress + 0.005);
        }
        // Smoothstep
        var ease = formProgress * formProgress * (3 - 2 * formProgress);

        ctx.clearRect(0, 0, W, H);

        // Rotation angle for this frame (lerps from front view to side view)
        var rotAngle = ROT_START + (ROT_END - ROT_START) * ease;
        cosR = Math.cos(rotAngle);
        sinR = Math.sin(rotAngle);

        // Grid floor
        if (ease > 0.28) drawGrid(Math.min(1, (ease - 0.28) / 0.55));

        // Wave sweep position
        var wavePos = ((t * WAVE_SPEED) % 1.4 - 0.2) * CAR_SPAN + CAR_MIN_X;

        ctx.globalCompositeOperation = 'lighter';

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            var p = particles[i];

            // Lerp from scatter to target
            var ix = p.rx + (p.tx - p.rx) * ease;
            var iy = p.ry + (p.ty - p.ry) * ease;
            var iz = p.rz + (p.tz - p.rz) * ease;

            // Subtle breathing oscillation (post-formation)
            if (ease > 0.5) {
                var bf = (ease - 0.5) * 2;
                ix += Math.sin(t * 0.72 + p.offset) * 0.13 * bf;
                iy += Math.cos(t * 0.58 + p.offset * 1.3) * 0.10 * bf;
            }

            // Scatter drift (pre-formation)
            if (ease < 0.95) {
                var df = 1 - ease;
                ix += Math.sin(t * 0.27 + p.offset) * 0.55 * df;
                iy += Math.cos(t * 0.19 + p.offset * 1.5) * 0.44 * df;
            }

            // Project to screen
            var proj = projectPoint(ix, iy, iz);
            var sx = proj.sx;
            var sy = proj.sy;

            // Mouse repulsion (screen-space)
            if (MOUSE_ENABLED && ease > 0.35) {
                var mdx = sx - mouse.x;
                var mdy = sy - mouse.y;
                var mDistSq = mdx * mdx + mdy * mdy;
                var repR = 85; // pixels
                if (mDistSq < repR * repR && mDistSq > 0.5) {
                    var mDist = Math.sqrt(mDistSq);
                    var force = (1 - mDist / repR) * 32 * ease;
                    sx += (mdx / mDist) * force;
                    sy += (mdy / mDist) * force;
                }
            }

            // Depth dimming: particles on far side (pz > 0) appear dimmer
            var depthDim = Math.max(0.55, 1 - Math.max(0, proj.pz) * 0.018);

            // Color: metallic base → brand red sweep
            var cr = p.br, cg = p.bg, cb = p.bb;
            if (ease > 0.65) {
                var distWave = Math.abs(p.tx - wavePos);
                if (distWave < WAVE_WIDTH) {
                    var wint = (1 - distWave / WAVE_WIDTH) * Math.min(1, (ease - 0.65) / 0.3);
                    var wi = wint * wint * (3 - 2 * wint);
                    cr += (RED_R / 255 - cr) * wi;
                    cg += (RED_G / 255 - cg) * wi;
                    cb += (RED_B / 255 - cb) * wi;
                }
            }

            // Type highlights
            if (p.ptype === 2 && ease > 0.8) { // taillight: warm red-orange
                var te = Math.min(1, (ease - 0.8) * 5);
                cr += (1.0 - cr) * te * 0.75;
                cg *= (1 - te * 0.55);
                cb *= (1 - te * 0.55);
            }
            if (p.ptype === 1 && ease > 0.8) { // headlight: cool blue-white
                var he = Math.min(1, (ease - 0.8) * 5);
                cr += (0.82 - cr) * he * 0.35;
                cg += (0.89 - cg) * he * 0.35;
                cb += (1.00 - cb) * he * 0.35;
            }

            var alpha = (0.35 + ease * 0.55) * depthDim * (0.50 + p.size * 0.50);
            var radius = BASE_SIZE * p.size * Math.max(0.45, proj.persp);

            var r255 = Math.round(cr * 255);
            var g255 = Math.round(cg * 255);
            var b255 = Math.round(cb * 255);
            var a1 = (alpha * 0.78).toFixed(2);

            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, TAU);
            ctx.fillStyle = 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',' + a1 + ')';
            ctx.fill();

            // Soft glow halo (every 5th particle, tighter radius — keeps silhouette crisp)
            if (i % 5 === 0) {
                ctx.beginPath();
                ctx.arc(sx, sy, radius * 2.0, 0, TAU);
                ctx.fillStyle = 'rgba(' + r255 + ',' + g255 + ',' + b255 + ',' + (alpha * 0.035).toFixed(3) + ')';
                ctx.fill();
            }
        }

        ctx.globalCompositeOperation = 'source-over';

        drawLightSweep(t, ease);
        drawFlares(ease);
        drawVignette();
    }

    rafId = requestAnimationFrame(animate);
})();
