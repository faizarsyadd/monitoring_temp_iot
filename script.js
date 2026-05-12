const ESP32_IP = '192.168.1.9'; // SESUAIKAN IP ESP32 KAMU
const API_URL = `http://${ESP32_IP}/data`;

let historyData = JSON.parse(localStorage.getItem('iotHistory')) || [];
let currentDist = 0; // Variabel global untuk menampung jarak sensor

// Tunggu DOM (HTML) siap sepenuhnya
window.addEventListener('DOMContentLoaded', () => {
    const canvasElement = document.getElementById('liveChart');
    const radarCanvas = document.getElementById('radarCanvas'); // Pastikan ID ini ada di HTML
    
    if (!canvasElement) {
        console.error("Elemen 'liveChart' tidak ditemukan di HTML!");
        return;
    }

    /* ============================================================
       1. KONFIGURASI CHART (SUHU)
       ============================================================ */
    const ctx = canvasElement.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historyData.map(item => item.waktu),
            datasets: [{
                data: historyData.map(item => item.suhu),
                borderColor: '#00d4ff',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                backgroundColor: 'rgba(0, 212, 255, 0.05)',
                pointRadius: 0, 
                pointHitRadius: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { display: false } },
                y: {
                    beginAtZero: false, 
                    suggestedMin: 25, 
                    suggestedMax: 45, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#8a8f9d', padding: 10 }
                }
            },
            layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } }
        }
    });

    /* ============================================================
       2. LOGIKA RADAR (ULTRASONIK) - BERDASARKAN image_e182b6.png
       ============================================================ */
   /* ============================================================
       RADAR TACTICAL V2 (UPGRADED VISUALS)
       ============================================================ */
    const rtx = radarCanvas.getContext('2d');
    let angle = 0;
    radarCanvas.width = 300;
    radarCanvas.height = 300;
    const centerX = radarCanvas.width / 2;
    const centerY = radarCanvas.height / 2;
    const radius = 120;

    function drawRadar() {
        // 1. Efek Fade Out yang halus (Motion Blur)
        rtx.fillStyle = 'rgba(9, 12, 16, 0.12)';
        rtx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);

        // 2. Lingkaran Grid dengan Efek Glow
        rtx.shadowBlur = 0;
        rtx.strokeStyle = 'rgba(0, 255, 157, 0.15)';
        for (let i = 1; i <= 4; i++) {
            rtx.beginPath();
            rtx.arc(centerX, centerY, (radius / 4) * i, 0, Math.PI * 2);
            rtx.stroke();
        }

        // 3. Garis Sumbu (Arah Mata Angin)
        rtx.setLineDash([5, 5]); // Garis putus-putus
        rtx.beginPath();
        rtx.moveTo(centerX - radius, centerY); rtx.lineTo(centerX + radius, centerY);
        rtx.moveTo(centerX, centerY - radius); rtx.lineTo(centerX, centerY + radius);
        rtx.stroke();
        rtx.setLineDash([]); // Reset ke garis solid

        // 4. Sapuan Radar dengan Gradiasi (Sweep Effect)
        rtx.save();
        rtx.translate(centerX, centerY);
        rtx.rotate(angle);
        
        let gradient = rtx.createRadialGradient(0, 0, 0, 0, 0, radius);
        gradient.addColorStop(0, 'rgba(0, 255, 157, 0)');
        gradient.addColorStop(1, 'rgba(0, 255, 157, 0.4)');
        
        rtx.beginPath();
        rtx.moveTo(0, 0);
        rtx.arc(0, 0, radius, -0.2, 0); // Lebar sapuan
        rtx.closePath();
        rtx.fillStyle = gradient;
        rtx.fill();
        
        // Garis depan sapuan yang terang
        rtx.beginPath();
        rtx.strokeStyle = '#00ff9d';
        rtx.lineWidth = 2;
        rtx.moveTo(0, 0);
        rtx.lineTo(radius, 0);
        rtx.stroke();
        rtx.restore();

        // 5. Gambar Objek (Titik Merah Berkedip)
        if (currentDist > 0 && currentDist < 100) { 
            let drawDist = (currentDist / 100) * radius;
            // Titik di sumbu depan (atas)
            let objX = centerX;
            let objY = centerY - drawDist;

            // Efek deteksi objek (Ping)
            rtx.beginPath();
            rtx.fillStyle = '#ff4d4d';
            rtx.shadowBlur = 15;
            rtx.shadowColor = "#ff4d4d";
            rtx.arc(objX, objY, 5, 0, Math.PI * 2);
            rtx.fill();
            
            // Lingkaran luar objek (Ring deteksi)
            rtx.beginPath();
            rtx.strokeStyle = `rgba(255, 77, 77, ${Math.abs(Math.sin(Date.now()/200))})`;
            rtx.arc(objX, objY, 10, 0, Math.PI * 2);
            rtx.stroke();
            rtx.shadowBlur = 0;
        }

        // 6. Dekorasi Angka Derajat (Opsional)
        rtx.fillStyle = "rgba(0, 255, 157, 0.5)";
        rtx.font = "8px Orbitron";
        rtx.fillText("0°", centerX - 5, centerY - radius - 5);
        rtx.fillText("180°", centerX - 10, centerY + radius + 12);

        angle += 0.03; // Putaran pelan agar elegan
        requestAnimationFrame(drawRadar);
    }
    drawRadar(); // Mulai animasi radar

    /* ============================================================
       3. FUNGSI UPDATE DATA (INTEGRASI ESP32)
       ============================================================ */
    async function updateDashboard() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Offline");

            const data = await response.json();
            const suhu = data.suhu;
            const isHot = data.isHot;
            currentDist = data.jarak; // Update variabel jarak untuk radar
            
            const waktu = new Date().toLocaleTimeString([], { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });

            // A. Update UI Teks & Radar Info
            document.getElementById('temp-val').innerText = `${suhu.toFixed(1)}°C`;
            document.getElementById('avg-display').innerText = `${suhu.toFixed(1)}°C`;
            if(document.getElementById('radar-dist')) {
                document.getElementById('radar-dist').innerText = currentDist.toFixed(1);
            }
            
            const statusBadge = document.getElementById('status-val');

            // B. Mode Danger (Suhu atau Jarak terlalu dekat < 20cm)
            if (isHot || (currentDist < 20 && currentDist > 0)) {
                document.body.classList.add('danger-mode');
                statusBadge.innerText = isHot ? "CRITICAL TEMP" : "OBJECT DETECTED";
                statusBadge.className = "neon-red"; 
                chart.data.datasets[0].borderColor = '#ff4d4d';
                chart.data.datasets[0].backgroundColor = 'rgba(255, 77, 77, 0.1)';
            } else {
                document.body.classList.remove('danger-mode');
                statusBadge.innerText = "NORMAL";
                statusBadge.className = "neon-green";
                chart.data.datasets[0].borderColor = '#00d4ff';
                chart.data.datasets[0].backgroundColor = 'rgba(0, 212, 255, 0.05)';
            }

            // C. Update Array Data Chart
            historyData.push({ waktu, suhu });
            if (historyData.length > 30) historyData.shift(); 

            // D. Refresh Chart
            chart.data.labels = historyData.map(d => d.waktu);
            chart.data.datasets[0].data = historyData.map(d => d.suhu);
            chart.update('none'); 

            // E. Update Tabel & Summary
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
        if(!tbody) return;
        const latest = [...historyData].reverse().slice(0, 6);
        tbody.innerHTML = latest.map(d => `
            <tr>
                <td>${d.waktu}</td>
                <td>${d.suhu.toFixed(1)}°C</td>
                <td><i class="fas fa-wave-square" style="color: ${chart.data.datasets[0].borderColor}"></i></td>
            </tr>
        `).join('');
    }

    function updateSummary() {
        if (historyData.length === 0) return;
        const temps = historyData.map(d => d.suhu);
        const avg = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
        const peak = Math.max(...temps).toFixed(1);
        const low = Math.min(...temps).toFixed(1);

        if(document.getElementById('stat-avg')) document.getElementById('stat-avg').innerText = `${avg}°C`;
        if(document.getElementById('stat-peak')) document.getElementById('stat-peak').innerText = `${peak}°C`;
        if(document.getElementById('stat-low')) document.getElementById('stat-low').innerText = `${low}°C`;
    }

    // Interval Update
    setInterval(updateDashboard, 1000);
    updateDashboard();

    // Simpan history tiap 10 detik
    setInterval(() => {
        localStorage.setItem('iotHistory', JSON.stringify(historyData));
    }, 10000);
});