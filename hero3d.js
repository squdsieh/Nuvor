import * as THREE from 'three';

// --- Performance Tier Detection ---
function getPerformanceTier() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 0;
    const isMobile = window.innerWidth <= 768;
    return isMobile ? 1 : 2;
}

const tier = getPerformanceTier();
if (tier === 0) {
    // No WebGL — keep hero-img fallback visible, do nothing
} else {
    init(tier);
}

function init(tier) {
    const heroSection = document.getElementById('hero');
    const canvasEl = document.getElementById('hero-canvas');
    if (!heroSection || !canvasEl) return;

    heroSection.classList.add('has-3d');

    // --- Config per tier ---
    const PARTICLE_COUNT = tier === 2 ? 12000 : 2500;
    const POINT_SIZE = tier === 2 ? 1.8 : 2.2;
    const MOUSE_ENABLED = tier === 2;

    // --- Car silhouette control points (sports car side profile) ---
    // Coordinates normalized to roughly -20..+20 range on X, -6..+6 on Y
    const carOutline = [
        // Bottom line (left to right)
        [-18, -4], [-16, -4.5], [-14, -4.8], [-12, -5],
        // Front wheel arch
        [-11, -5], [-10.5, -3.5], [-9, -3], [-7.5, -3.5], [-7, -5],
        // Underbody
        [-6, -5], [-4, -5], [-2, -5], [0, -5], [2, -5], [4, -5],
        // Rear wheel arch
        [5, -5], [5.5, -3.5], [7, -3], [8.5, -3.5], [9, -5],
        // Rear bottom
        [10, -5], [12, -4.8], [14, -4.5],
        // Rear (going up)
        [14, -4], [14.5, -3], [15, -2], [15, -1], [14.8, 0],
        // Rear window / roofline
        [14, 0.5], [13, 1.5], [11, 2.5], [9, 3.2], [7, 3.8],
        // Roof
        [5, 4], [3, 4.1], [1, 4.1], [-1, 4], [-3, 3.8],
        // Windshield
        [-5, 3.5], [-7, 2.5], [-9, 1],
        // Hood
        [-10, 0.2], [-12, -0.5], [-14, -1], [-16, -1.5], [-18, -2],
        // Front
        [-18, -2.5], [-18.5, -3], [-18.5, -3.5], [-18, -4],
    ];

    // --- Generate target positions from car silhouette ---
    function generateCarPoints(count) {
        const points = [];

        // 1. Edge points (40% of particles) — trace the outline with density
        const edgeCount = Math.floor(count * 0.4);
        for (let i = 0; i < edgeCount; i++) {
            const t = i / edgeCount;
            const idx = t * (carOutline.length - 1);
            const i0 = Math.floor(idx);
            const i1 = Math.min(i0 + 1, carOutline.length - 1);
            const frac = idx - i0;
            const x = carOutline[i0][0] * (1 - frac) + carOutline[i1][0] * frac;
            const y = carOutline[i0][1] * (1 - frac) + carOutline[i1][1] * frac;
            // Add slight random offset for organic feel
            points.push([
                x + (Math.random() - 0.5) * 0.4,
                y + (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 1.5
            ]);
        }

        // 2. Fill points (50% of particles) — fill the interior of the car body
        const fillCount = Math.floor(count * 0.5);
        for (let i = 0; i < fillCount; i++) {
            const x = -18 + Math.random() * 33; // -18 to +15
            // Y range depends on x position (approximate car body bounds)
            let yMin = -4.5, yMax = 0;

            // Rough body shape bounds per x region
            if (x < -10) {
                yMin = -4; yMax = -0.5 + (x + 18) * 0.2;
            } else if (x < -7) {
                // Front wheel arch area — skip some
                yMin = -2; yMax = 1 + (x + 10) * 0.5;
            } else if (x < 5) {
                yMin = -4.5; yMax = 3.5 + (x + 7) * 0.05;
            } else if (x < 9) {
                // Rear wheel arch — skip some
                yMin = -2; yMax = 3.5;
            } else {
                yMin = -4; yMax = 2.5 - (x - 9) * 0.4;
            }

            const y = yMin + Math.random() * (yMax - yMin);
            points.push([
                x + (Math.random() - 0.5) * 0.3,
                y + (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 1.2
            ]);
        }

        // 3. Detail points (10%) — extra density at wheels, headlights, taillights
        const detailCount = count - edgeCount - fillCount;
        const detailAreas = [
            { cx: -9, cy: -3, r: 2.2 },   // Front wheel
            { cx: 7, cy: -3, r: 2.2 },     // Rear wheel
            { cx: -18, cy: -2.5, r: 1.5 }, // Headlight
            { cx: 14.5, cy: -1, r: 1.5 },  // Taillight
        ];
        for (let i = 0; i < detailCount; i++) {
            const area = detailAreas[i % detailAreas.length];
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * area.r;
            points.push([
                area.cx + Math.cos(angle) * dist,
                area.cy + Math.sin(angle) * dist,
                (Math.random() - 0.5) * 1.0
            ]);
        }

        return points;
    }

    // --- Three.js Setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 0, 50);

    const renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        alpha: true,
        antialias: tier === 2,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === 2 ? 2 : 1));
    renderer.setClearColor(0x000000, 1);

    // --- Particle System ---
    const carPoints = generateCarPoints(PARTICLE_COUNT);
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const targets = new Float32Array(PARTICLE_COUNT * 3);
    const randoms = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const offsets = new Float32Array(PARTICLE_COUNT); // per-particle animation offset

    const baseColor = { r: 0.7, g: 0.7, b: 0.75 }; // cool gray-white

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Target: car silhouette
        targets[i3] = carPoints[i][0];
        targets[i3 + 1] = carPoints[i][1];
        targets[i3 + 2] = carPoints[i][2];

        // Random: scattered positions
        randoms[i3] = (Math.random() - 0.5) * 60;
        randoms[i3 + 1] = (Math.random() - 0.5) * 40;
        randoms[i3 + 2] = (Math.random() - 0.5) * 30;

        // Start at random positions
        positions[i3] = randoms[i3];
        positions[i3 + 1] = randoms[i3 + 1];
        positions[i3 + 2] = randoms[i3 + 2];

        // Base color
        colors[i3] = baseColor.r + (Math.random() - 0.5) * 0.15;
        colors[i3 + 1] = baseColor.g + (Math.random() - 0.5) * 0.15;
        colors[i3 + 2] = baseColor.b + (Math.random() - 0.5) * 0.15;

        // Random offset for animation variety
        offsets[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom shader material for soft circular particles
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uSize: { value: POINT_SIZE * window.devicePixelRatio },
        },
        vertexShader: `
            attribute vec3 color;
            varying vec3 vColor;
            uniform float uSize;
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = uSize * (50.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                float alpha = 1.0 - smoothstep(0.2, 0.5, d);
                gl_FragColor = vec4(vColor, alpha * 0.85);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- Faint grid floor for depth ---
    const gridGeo = new THREE.PlaneGeometry(80, 30, 40, 15);
    const gridMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x8b0000) },
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;
            uniform vec3 uColor;
            uniform float uTime;
            void main() {
                vec2 grid = abs(fract(vUv * vec2(40.0, 15.0)) - 0.5);
                float line = min(grid.x, grid.y);
                float alpha = 1.0 - smoothstep(0.0, 0.05, line);
                alpha *= 0.06;
                // Fade at edges
                float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x)
                               * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
                gl_FragColor = vec4(uColor, alpha * edgeFade);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.position.set(0, -6, 0);
    grid.rotation.x = -Math.PI * 0.4;
    scene.add(grid);

    // --- Mouse tracking ---
    const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
    if (MOUSE_ENABLED) {
        window.addEventListener('mousemove', (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            // Project to approximate world coordinates at z=0
            mouse.worldX = mouse.x * 25;
            mouse.worldY = mouse.y * 15;
        });
    }

    // --- State ---
    let isForming = false;
    let formProgress = 0; // 0 = scattered, 1 = car shape
    let isVisible = true;
    let animationId;

    // Listen for preloader done
    window.addEventListener('hero-reveal', () => {
        isForming = true;
    });

    // Scroll visibility — pause when off-screen
    const observer = new IntersectionObserver((entries) => {
        isVisible = entries[0].isIntersecting;
        if (isVisible && !animationId) animate(performance.now());
    }, { threshold: 0.05 });
    observer.observe(heroSection);

    // --- Resize ---
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // --- Animation Loop ---
    const posAttr = geometry.getAttribute('position');
    const colorAttr = geometry.getAttribute('color');
    const RED = { r: 0.545, g: 0.0, b: 0.0 }; // #8b0000
    const WAVE_SPEED = 0.15;
    const WAVE_WIDTH = 8;
    const CAR_MIN_X = -19;
    const CAR_MAX_X = 16;
    const CAR_SPAN = CAR_MAX_X - CAR_MIN_X;

    function animate(time) {
        if (!isVisible) {
            animationId = null;
            return;
        }
        animationId = requestAnimationFrame(animate);

        const t = time * 0.001; // seconds

        // --- Formation progress ---
        if (isForming && formProgress < 1) {
            formProgress = Math.min(1, formProgress + 0.008); // ~2s to fully form
        }

        // Easing
        const ease = formProgress * formProgress * (3 - 2 * formProgress); // smoothstep

        // --- Update particles ---
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            const offset = offsets[i];

            // Lerp position: random → target
            const tx = targets[i3];
            const ty = targets[i3 + 1];
            const tz = targets[i3 + 2];
            const rx = randoms[i3];
            const ry = randoms[i3 + 1];
            const rz = randoms[i3 + 2];

            let px = rx + (tx - rx) * ease;
            let py = ry + (ty - ry) * ease;
            let pz = rz + (tz - rz) * ease;

            // Breathing oscillation (when formed)
            if (ease > 0.5) {
                const breathe = (ease - 0.5) * 2; // 0→1 over second half
                px += Math.sin(t * 0.8 + offset) * 0.15 * breathe;
                py += Math.cos(t * 0.6 + offset * 1.3) * 0.12 * breathe;
                pz += Math.sin(t * 0.5 + offset * 0.7) * 0.1 * breathe;
            }

            // Scattered drift (when not yet formed)
            if (ease < 1) {
                const drift = 1 - ease;
                px += Math.sin(t * 0.3 + offset) * 0.5 * drift;
                py += Math.cos(t * 0.2 + offset * 1.5) * 0.4 * drift;
            }

            // Mouse repulsion
            if (MOUSE_ENABLED && ease > 0.3) {
                const dx = px - mouse.worldX;
                const dy = py - mouse.worldY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 5) {
                    const force = (1 - dist / 5) * 2.5 * ease;
                    px += (dx / dist) * force;
                    py += (dy / dist) * force;
                }
            }

            posAttr.array[i3] = px;
            posAttr.array[i3 + 1] = py;
            posAttr.array[i3 + 2] = pz;

            // --- Color sweep (wrap effect) ---
            if (ease > 0.7) {
                const wavePos = ((t * WAVE_SPEED) % 1.4 - 0.2) * CAR_SPAN + CAR_MIN_X;
                const distFromWave = Math.abs(tx - wavePos);
                if (distFromWave < WAVE_WIDTH) {
                    const intensity = (1 - distFromWave / WAVE_WIDTH) * ((ease - 0.7) / 0.3);
                    const smoothIntensity = intensity * intensity * (3 - 2 * intensity);
                    colorAttr.array[i3] = baseColor.r + (RED.r - baseColor.r) * smoothIntensity;
                    colorAttr.array[i3 + 1] = baseColor.g + (RED.g - baseColor.g) * smoothIntensity;
                    colorAttr.array[i3 + 2] = baseColor.b + (RED.b - baseColor.b) * smoothIntensity;
                } else {
                    // Return to base
                    colorAttr.array[i3] += (baseColor.r + (Math.sin(offset) * 0.08) - colorAttr.array[i3]) * 0.03;
                    colorAttr.array[i3 + 1] += (baseColor.g + (Math.cos(offset) * 0.08) - colorAttr.array[i3 + 1]) * 0.03;
                    colorAttr.array[i3 + 2] += (baseColor.b + (Math.sin(offset * 0.5) * 0.08) - colorAttr.array[i3 + 2]) * 0.03;
                }
            }
        }

        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;

        // Subtle camera sway
        camera.position.x = Math.sin(t * 0.1) * 0.5;
        camera.position.y = Math.cos(t * 0.08) * 0.3;
        camera.lookAt(0, 0, 0);

        // Grid animation
        gridMat.uniforms.uTime.value = t;

        renderer.render(scene, camera);
    }

    animate(performance.now());
}
