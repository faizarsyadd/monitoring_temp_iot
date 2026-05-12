/**
 * FaizTemp IoT Dashboard - Full Script
 * Integrasi: Live Chart (Suhu & Ultrasonic Pulse) + Radar System
 */

const ESP32_IP = '192.168.1.9'; // SESUAIKAN IP ESP32 KAMU
const API_URL = `http://${ESP32_IP}/data`;

let historyData = JSON.parse(localStorage.getItem('iotHistory')) || [];
let currentDist = 0;

window.addEventListener('DOMContentLoaded', () => {
    const canvasElement = document.getElementById('liveChart');
    const radarCanvas = document.getElementById('radarCanvas');
    
    if (!canvasElement || !radarCanvas) {
        console.error("Elemen UI tidak ditemukan!");
        return;
    }

    /* ============================================================
       1. MULTI-AXIS CHART (SUHU & PULSA ULTRASONIK)
       ============================================================ */
    const ctx = canvasElement.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historyData.map(item => item.waktu),
            datasets: [
                {
                    label: 'Temperature',
                    data: historyData.map(item => item.suhu),
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4, // Melengkung halus
                    fill: true,
                    yAxisID: 'y',
                    pointRadius: 0
                },
                {
                    label: 'Ultrasonic Pulse',
                    data: historyData.map(item => item.pulse || 0),
                    borderColor: '#00ff9d', // Hijau Radar
                    backgroundColor: 'rgba(0, 255, 157, 0.05)',
                    borderWidth: 2,
                    tension: 0, // Kaku (Square Wave) untuk sinyal deteksi
                    fill: true,
                    yAxisID: 'y1',
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { display: false } },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    suggestedMin: 20,
                    suggestedMax: 50,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8a8f9d' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: { drawOnChartArea: false },
                    ticks: { display: false } // Sembunyikan angka pulsa agar bersih
                }
            }
        }
    });

    /* ============================================================
       2. RADAR TACTICAL V2 (UPGRADED VISUALS)
       ============================================================ */
    const rtx = radarCanvas.getContext('2d');
    let angle = 0;
    radarCanvas.width = 300;
    radarCanvas.height = 300;
    const centerX = radarCanvas.width / 2;
    const centerY = radarCanvas.height / 2;
    const radius = 120;

    function drawRadar() {
        // Efek Motion Blur pada sapuan
        rtx.fillStyle = 'rgba(9, 12, 16, 0.15)';
        rtx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);

        // Lingkaran Grid
        rtx.strokeStyle = 'rgba(0, 255, 157, 0.15)';
        rtx.setLineDash([]);
        for (let i = 1; i <= 4; i++) {
            rtx.beginPath();
            rtx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2);
            rtx.stroke();
        }

        // Sapuan Radar (Gradient Sweep)
        rtx.save();
        rtx.translate(centerX, centerY);
        rtx.rotate(angle);
        let grad = rtx.createRadialGradient(0, 0, 0, 0, 0, radius);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, 'rgba(0, 255, 157, 0.4)');
        
        rtx.beginPath();
        rtx.moveTo(0, 0);
        rtx.arc(0, 0, radius, -0.4, 0);
        rtx.fillStyle = grad;
        rtx.fill();

        // Garis depan sapuan
        rtx.strokeStyle = '#00ff9d';
        rtx.lineWidth = 2;
        rtx.beginPath();
        rtx.moveTo(0, 0);
        rtx.lineTo(radius, 0);
        rtx.stroke();
        rtx.restore();

        // Gambar Objek (Titik Merah Berkedip)
        if (currentDist > 0 && currentDist < 100) { 
            let drawDist = (currentDist / 100) * radius;
            let objY = centerY - drawDist; // Objek muncul di sumbu vertikal atas

            rtx.beginPath();
            rtx.fillStyle = '#ff4d4d';
            rtx.shadowBlur = 15;
            rtx.shadowColor = "#ff4d4d";
            rtx.arc(centerX, objY, 6, 0, Math.PI * 2);
            rtx.fill();
            
            // Ring Pulse Objek
            rtx.beginPath();
            rtx.strokeStyle = `rgba(255, 77, 77, ${Math.abs(Math.sin(Date.now()/200))})`;
            rtx.arc(centerX, objY, 12, 0, Math.PI * 2);
            rtx.stroke();
            rtx.shadowBlur = 0;
        }

        angle += 0.04;
        requestAnimationFrame(drawRadar);
    }
    drawRadar();

    /* ============================================================
       3. UPDATE DASHBOARD (LOGIC & API)
       ============================================================ */
    async function updateDashboard() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Offline");

            const data = await response.json();
            const waktu = new Date().toLocaleTimeString([], { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
            
            currentDist = data.jarak;
            
            // Konversi Jarak ke Pulsa (Semakin dekat, grafik semakin tinggi)
            let pulseValue = (currentDist > 0 && currentDist < 100) ? (100 - currentDist) : 0;

            // A. Update UI Teks
            document.getElementById('temp-val').innerText = `${data.suhu.toFixed(1)}°C`;
            document.getElementById('radar-dist').innerText = currentDist.toFixed(1);
            
            const statusBadge = document.getElementById('status-val');
            if (data.isHot || (currentDist < 20 && currentDist > 0)) {
                statusBadge.innerText = "CRITICAL";
                statusBadge.className = "neon-red";
            } else {
                statusBadge.innerText = "NORMAL";
                statusBadge.className = "neon-green";
            }

            // B. Update Data History
            historyData.push({ 
                waktu, 
                suhu: data.suhu, 
                pulse: pulseValue 
            });
            if (historyData.length > 40) historyData.shift();

            // C. Refresh Chart Instan
            chart.data.labels = historyData.map(d => d.waktu);
            chart.data.datasets[0].data = historyData.map(d => d.suhu);
            chart.data.datasets[1].data = historyData.map(d => d.pulse);
            chart.update('none'); 

            renderTable();
            updateSummary();

        } catch (err) {
            document.getElementById('status-val').innerText = "DISCONNECTED";
            document.getElementById('status-val').className = "neon-text";
        }
    }

    /* ============================================================
       4. FUNGSI PENDUKUNG
       ============================================================ */
    function renderTable() {
        const tbody = document.getElementById('historyBody');
        const latest = [...historyData].reverse().slice(0, 6);
        tbody.innerHTML = latest.map(d => `
            <tr>
                <td>${d.waktu}</td>
                <td>${d.suhu.toFixed(1)}°C</td>
                <td><i class="fas fa-wave-square" style="color: ${d.pulse > 0 ? '#00ff9d' : '#444'}"></i> ${d.pulse > 0 ? 'Active' : 'Idle'}</td>
            </tr>
        `).join('');
    }

    function updateSummary() {
        if (historyData.length === 0) return;
        const temps = historyData.map(d => d.suhu);
        document.getElementById('stat-avg').innerText = `${(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)}°C`;
        document.getElementById('stat-peak').innerText = `${Math.max(...temps).toFixed(1)}°C`;
        document.getElementById('stat-low').innerText = `${Math.min(...temps).toFixed(1)}°C`;
    }

    setInterval(updateDashboard, 1000);
    updateDashboard();

    setInterval(() => {
        localStorage.setItem('iotHistory', JSON.stringify(historyData));
    }, 10000);
});