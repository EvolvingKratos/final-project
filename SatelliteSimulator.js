window.satellites = null;
window.animId = null;
// Store views and earthImages globally if you intend for handleAddNewSatellite to use them
// If not, they should be passed as parameters if needed, or derived from current state.
// For now, let's assume they are globally accessible or passed in initializeSatelliteSimulation.
let globalViews = []; 
let globalEarthImages = {};


function initializeSatelliteSimulation(views, earthImages, C_orbit, U_orbit, V_orbit, user_lat, user_lon) {
    globalViews = views; // Store for global access if needed
    globalEarthImages = earthImages; // Store for global access if needed

    // Define gravitational parameter (arbitrary units, scaled for simulation)
    const GM = 1.0; // Gravitational parameter for Earth
    const initialSatellites = [
        { r: 1 + 120 / 200, angle: 0, color: 'red', isDemo: true, name: 'Starlink-1', angularSpeed: 0.1, speedU: 0.1, speedV: 0, effectiveAngle: Math.atan2(0, 0.1), h: 0.1 * (1 + 120 / 200) ** 2, vr: 0 },
        { r: 1 + 150 / 200, angle: Math.PI / 5, color: 'green', isDemo: true, name: 'ISS', angularSpeed: 0.15, speedU: 0.1, speedV: 0.05, effectiveAngle: Math.atan2(0.05, 0.1), h: 0.15 * (1 + 150 / 200) ** 2, vr: 0 },
        { r: 1 + 180 / 200, angle: 2 * Math.PI / 5, color: 'blue', isDemo: true, name: 'OneWeb-1', angularSpeed: 0.2, speedU: 0.1, speedV: 0.1, effectiveAngle: Math.atan2(0.1, 0.1), h: 0.2 * (1 + 180 / 200) ** 2, vr: 0 },
        { r: 1 + 210 / 200, angle: 3 * Math.PI / 5, color: 'yellow', isDemo: true, name: 'GPS-1', angularSpeed: 0.25, speedU: 0.1, speedV: 0.15, effectiveAngle: Math.atan2(0.15, 0.1), h: 0.25 * (1 + 210 / 200) ** 2, vr: 0 },
        { r: 1 + 240 / 200, angle: 4 * Math.PI / 5, color: 'purple', isDemo: true, name: 'GEO-Sat-1', angularSpeed: 0.3, speedU: 0.1, speedV: 0.2, effectiveAngle: Math.atan2(0.2, 0.1), h: 0.3 * (1 + 240 / 200) ** 2, vr: 0 }
    ];
    window.satellites = initialSatellites;

    function updateTrajectories() {
        globalViews.forEach(view => { // Use globalViews here
            const offCtx = view.offscreen.getContext('2d');
            offCtx.clearRect(0, 0, view.offscreen.width, view.offscreen.height);

            const earthImg = new Image();
            earthImg.src = globalEarthImages[view.canvas.id]; // Use globalEarthImages here
            offCtx.drawImage(earthImg, 0, 0);

            const { C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj, mode } = view.config;
            const centerX = view.canvas.width / 2;
            const centerY = view.canvas.height / 2;
            const earth_radius = view.earth_radius;
            const isAux = view.canvas.id !== 'main';

            window.satellites.forEach(sat => {
                if (sat.r < 1) return;

                // Draw trajectory
                offCtx.strokeStyle = sat.color;
                offCtx.lineWidth = 2;
                offCtx.beginPath();
                let first = true;

                const angle = sat.effectiveAngle;
                const r = sat.r;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];

                if (sat.isDemo) {
                    // Circular trajectory for demo satellites
                    for (let phi = 0; phi <= 2 * Math.PI; phi += 0.01) {
                        const cosP = Math.cos(phi);
                        const sinP = Math.sin(phi);
                        const pos = [
                            r * (cosP * C_orbit[0] + sinP * dir[0]),
                            r * (cosP * C_orbit[1] + sinP * dir[1]),
                            r * (cosP * C_orbit[2] + sinP * dir[2])
                        ];
                        const x_proj = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                        const y_proj = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                        const z_proj = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];

                        const px = centerX + earth_radius * x_proj;
                        const py = centerY - earth_radius * y_proj;

                        if (!isAux && z_proj < 0) {
                            first = true;
                            continue;
                        }

                        if (first) {
                            offCtx.moveTo(px, py);
                            first = false;
                        } else {
                            offCtx.lineTo(px, py);
                        }
                    }
                } else {
                    // Conic section trajectory for custom satellites
                    const p = (sat.h ** 2) / GM; // Semi-latus rectum
                    const A = ((sat.h ** 2) / (GM * sat.r)) - 1;
                    const B = (sat.vr * sat.h) / GM;
                    let e = Math.sqrt(A * A + B * B); // Eccentricity
                    if (e < 1e-6) e = 0; // Treat very small eccentricity as circular
                    let f = Math.atan2(B, A); // True anomaly at current position
                    const omega_peri = sat.angle - f; // Argument of periapsis

                    let f_min, f_max, df = 0.01;
                    if (e < 1) {
                        // Elliptical orbit (stable)
                        f_min = 0;
                        f_max = 2 * Math.PI;
                    } else {
                        // Parabolic (e = 1) or hyperbolic (e > 1) orbit
                        const cos_arg = -1 / e;
                        let f_limit = (e >= 1 - 1e-6 && e <= 1 + 1e-6) ? Math.PI : Math.acos(Math.min(1, Math.max(-1, cos_arg)));
                        f_min = -f_limit;
                        f_max = f_limit;
                    }

                    for (let f_plot = f_min; f_plot <= f_max; f_plot += df) {
                        const cos_f = Math.cos(f_plot);
                        const r_plot = p / (1 + e * cos_f);
                        if (r_plot <= 0 || (r_plot < 1 && !isAux)) {
                            first = true;
                            continue;
                        }

                        const phi = omega_peri + f_plot;
                        const cosP = Math.cos(phi);
                        const sinP = Math.sin(phi);
                        const pos = [
                            r_plot * (cosP * C_orbit[0] + sinP * dir[0]),
                            r_plot * (cosP * C_orbit[1] + sinP * dir[1]),
                            r_plot * (cosP * C_orbit[2] + sinP * dir[2])
                        ];
                        const x_proj = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                        const y_proj = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                        const z_proj = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];

                        const px = centerX + earth_radius * x_proj;
                        const py = centerY - earth_radius * y_proj;

                        if (!isAux && z_proj < 0) {
                            first = true;
                            continue;
                        }

                        if (first) {
                            offCtx.moveTo(px, py);
                            first = false;
                        } else {
                            offCtx.lineTo(px, py);
                        }
                    }
                }
                offCtx.stroke();
            });

            if (isAux) {
                offCtx.font = '14px Arial';
                offCtx.textAlign = 'left';
                offCtx.fillStyle = '#FFFFFF';
                offCtx.fillText(view.canvas.id === 'second' ? 'Side View (East-West)' : 'Side View (North-South)', 10, 20);

                window.satellites.forEach((sat, i) => {
                    const speedText = mode === 'U' ? sat.speedU.toFixed(3) : mode === 'V' ? sat.speedV.toFixed(3) : sat.angularSpeed.toFixed(3);
                    const label = mode === 'U' ? 'U-comp' : mode === 'V' ? 'V-comp' : 'Net';
                    offCtx.fillStyle = sat.color;
                    offCtx.fillText(`${sat.name}: ${speedText} rad/s`, view.canvas.width - 250, 50 + i * 25);
                });
            }
        });
    }

    let lastTime = performance.now();
    function animate(timestamp) {
        const delta = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        for (let i = window.satellites.length - 1; i >= 0; i--) {
            const sat = window.satellites[i];
            if (sat.r < 1) continue;
            if (sat.isDemo) {
                // Demo satellites maintain circular orbits
                sat.angle += sat.angularSpeed * delta;
            } else {
                // Custom satellites follow two-body dynamics
                const a_r = (sat.h ** 2) / (sat.r ** 3) - GM / (sat.r ** 2); // Radial acceleration
                sat.vr += a_r * delta * 0.1; // Scale down acceleration for stability
                sat.r += sat.vr * delta; // Update radial distance
                sat.angularSpeed = sat.h / (sat.r ** 2); // Update angular speed
                sat.angle += sat.angularSpeed * delta; // Update angular position

                // Check for crash (r <= 1) or escape (r > 50)
                if (sat.r <= 1) {
                    const message = `${sat.name} crashed on Earth`;
                    logEvent(message);
                    window.satellites.splice(i, 1);
                    updateSatelliteList();
                    updateTrajectories();
                    i--; // Adjust index due to splice
                    continue;
                } else if (sat.r > 50) {
                    const message = `${sat.name} escaped the Earth`;
                    logEvent(message);
                    window.satellites.splice(i, 1);
                    updateSatelliteList();
                    updateTrajectories();
                    i--; // Adjust index due to splice
                    continue;
                }

                // Update effective angle for trajectory
                const p = (sat.h ** 2) / GM;
                const A = ((sat.h ** 2) / (GM * sat.r)) - 1;
                const B = (sat.vr * sat.h) / GM;
                const e = Math.sqrt(A * A + B * B);
                const f = Math.atan2(B, A);
                sat.effectiveAngle = sat.angle - f;
            }
        }

        updateTrajectories();

        globalViews.forEach(view => { // Use globalViews here
            const ctx = view.canvas.getContext('2d');
            const { C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj, mode } = view.config;
            const centerX = view.canvas.width / 2;
            const centerY = view.canvas.height / 2;
            const earth_radius = view.earth_radius;

            ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
            ctx.drawImage(view.offscreen, 0, 0);

            window.satellites.forEach(sat => {
                if (sat.r < 1) return;

                const r = sat.r;
                const cosA = Math.cos(sat.angle);
                const sinA = Math.sin(sat.angle);
                const angle = sat.effectiveAngle;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];

                const pos = [
                    r * (cosA * C_orbit[0] + sinA * dir[0]),
                    r * (cosA * C_orbit[1] + sinA * dir[1]),
                    r * (cosA * C_orbit[2] + sinA * dir[2])
                ];

                const x_proj = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                const y_proj = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                const z_proj = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];

                if (z_proj >= 0) {
                    const px = centerX + earth_radius * x_proj;
                    const py = centerY - earth_radius * y_proj;
                    ctx.fillStyle = sat.color;
                    ctx.beginPath();
                    ctx.arc(px, py, 5, 0, 2 * Math.PI);
                    ctx.fill();

                    if (view.canvas.id === 'main') {
                        ctx.font = '12px Arial';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.fillText(sat.name, px, py - 8);
                    }
                }
            });
        });

        window.animId = requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    function updateTimeAndIntervals() {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        if (document.getElementById('user-location').textContent.includes('Lat')) {
            const updatedIntervals = computeNextFreeIntervals(window.satellites, now);
            const intervalsDiv = document.getElementById('intervals');
            intervalsDiv.innerHTML = updatedIntervals.map((int, idx) => `<p>Interval ${idx + 1}: From ${int.start} to ${int.end} (${int.duration})</p>`).join('');
        }
    }

    updateTimeAndIntervals();
    setInterval(updateTimeAndIntervals, 1000);

    updateSatelliteList();

    // The "Delete Custom Satellite" button is redundant if the 'X' button is functional
    // and you only want to delete custom ones. Let's remove it for simplicity as per your UI requirement.
    // However, if you want to keep it, ensure it targets *only* custom satellites as previously attempted.
    // For now, I'll comment it out to align with only using the 'X' next to "imaginary satellites".
    /*
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Custom Satellite';
    deleteButton.onclick = () => {
        const customSats = window.satellites.filter(sat => !sat.isDemo);
        if (customSats.length === 0) {
            alert('No custom satellites to delete.');
            return;
        }
        // Find the index of the first custom satellite and delete it
        const satIndexToDelete = window.satellites.findIndex(sat => !sat.isDemo);
        if (satIndexToDelete > -1) {
            window.satellites.splice(satIndexToDelete, 1);
            updateTrajectories();
            updateSatelliteList();
        }
    };
    document.getElementById('controls').appendChild(deleteButton);
    */

    function logEvent(message) {
        const logDiv = document.getElementById('event-log');
        const p = document.createElement('p');
        p.textContent = message;
        logDiv.appendChild(p);
        logDiv.scrollTop = logDiv.scrollHeight; // Scroll to bottom
    }
}

// Moved these functions out of initializeSatelliteSimulation to be globally accessible
// as the HTML buttons call them directly.
window.handleAddNewSatellite = (isDefault = true) => { // Default to true for the original button
    const GM = 1.0; 
    
    if (isDefault) {
        // This is the "Add New Imaginary Sat (Default)" button logic
        const colors = ['cyan', 'magenta', 'lime', 'orange', 'gold']; // More distinct colors for new ones
        const newColor = colors[window.satellites.length % colors.length];
        const newRadiusOffset = 100 + window.satellites.length * 20; // Slightly increasing radius
        const newAngularSpeed = 0.1 + Math.random() * 0.1; // Random speed for variety
        const newName = `Imaginary Sat ${window.satellites.filter(s => s.isDemo).length + 1}`;

        const newSat = {
            r: 1 + newRadiusOffset / 200,
            angle: Math.random() * 2 * Math.PI,
            color: newColor,
            isDemo: true, // This is a demo satellite
            name: newName,
            angularSpeed: newAngularSpeed,
            speedU: 0.1, // Placeholder, actual components would depend on orbit normal
            speedV: 0,   // Placeholder
            effectiveAngle: Math.atan2(0, 0.1), // Placeholder
            h: newAngularSpeed * (1 + newRadiusOffset / 200) ** 2, // Specific angular momentum for circular
            vr: 0 // Circular orbit has no radial velocity
        };
        window.satellites.push(newSat);
        updateTrajectories();
        updateSatelliteList();
        logEvent(`Added default imaginary satellite: ${newSat.name}`);
        return;
    }

    // This is the logic for a "Custom Satellite" (if you add a separate button for it)
    const orbitType = prompt('Enter orbit type (crash, stable, escape):').toLowerCase();
    let r, angular, vr, orbitDescription;

    const baseRadius = 1.5; // Normalized units, R_Earth = 1
    const circularSpeed = Math.sqrt(GM / baseRadius); 
    const escapeSpeed = Math.sqrt(2 * GM / baseRadius);

    if (orbitType === 'crash') {
        r = baseRadius;
        angular = circularSpeed * 0.5; 
        vr = -0.1; 
        orbitDescription = 'Crashing orbit (spirals inward)';
    } else if (orbitType === 'stable') {
        r = baseRadius;
        angular = circularSpeed; 
        vr = 0; 
        orbitDescription = 'Stable circular orbit';
    } else if (orbitType === 'escape') {
        r = baseRadius;
        angular = escapeSpeed * 1.2; 
        vr = 0.05; 
        orbitDescription = 'Escaping hyperbolic orbit';
    } else {
        alert('Invalid orbit type. Please enter "crash", "stable", or "escape".');
        return;
    }

    const name = prompt('Enter satellite name:') || `Custom Sat ${window.satellites.length + 1}`;

    const colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'pink'];
    const color = colors[window.satellites.length % colors.length];

    const h = angular * r ** 2;
    const A = ((h ** 2) / (GM * r)) - 1;
    const B = (vr * h) / GM;
    const e = Math.sqrt(A * A + B * B);
    const f = Math.atan2(B, A);
    const effectiveAngle = Math.PI / 2 - f;

    logEvent(`Added ${name} with ${orbitDescription}.`);

    const newSat = {
        r,
        angularSpeed: angular,
        angle: Math.PI / 2,
        color,
        isDemo: false, // This is a custom satellite
        name,
        speedU: 0.1, 
        speedV: angular - 0.1, 
        effectiveAngle,
        h, 
        vr 
    };

    window.satellites.push(newSat);
    updateTrajectories();
    updateSatelliteList();
};

window.handleDeleteSatellite = (index) => {
    // Allows deletion of both demo and custom satellites
    if (index >= 0 && index < window.satellites.length) {
        const deletedSatName = window.satellites[index].name;
        window.satellites.splice(index, 1);
        updateSatelliteList();
        updateTrajectories();
        logEvent(`Deleted satellite: ${deletedSatName}`);
    }
};

// Helper function to update the satellite list in the UI
function updateSatelliteList() {
    const listDiv = document.getElementById('sat-list');
    listDiv.innerHTML = '';
    window.satellites.forEach((sat, index) => {
        const p = document.createElement('p');
        p.style.color = sat.color;
        // The delete button is shown for all satellites, but the prompt message specifies "imaginary"
        const deleteButton = `<button onclick="handleDeleteSatellite(${index})">X</button>`;
        const typeLabel = sat.isDemo ? `<span style="color: #6c757d; font-style: italic;">(Default)</span>` : `<span style="color: #6c757d; font-style: italic;">(Custom)</span>`;
        p.innerHTML = `${sat.name} ${typeLabel} ${deleteButton}`;
        listDiv.appendChild(p);
    });
    document.getElementById('sat-header').textContent = `Active Satellites (${window.satellites.length} Total)`;
}

// Event logging utility function
function logEvent(message) {
    const logDiv = document.getElementById('event-log');
    const p = document.createElement('p');
    p.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight; // Scroll to bottom
}

// OverFlightCalculator.js (No changes needed, keeping it as is)
// ... (Your original OverFlightCalculator.js content here) ...