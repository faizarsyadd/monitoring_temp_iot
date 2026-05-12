/* ============================================================
   IOT DASHBOARD LOGIC - FaizTemp
   Features: Realtime Fetch, Local Storage, Neon Chart, Anti-Lag
   ============================================================ */

const ESP32_IP = '192.168.1.9'; // Sesuaikan dengan IP di OLED
const API_URL = `http://${ESP32_IP}/data`;

// 1. Inisialisasi Data dari Local Storage
let historyData = JSON.parse(localStorage.getItem('iotHistory')) || [];

document.addEventListener('DOMContentLoaded', () => {
    
    /* =========================
       CHART CONFIGURATION
       ========================= */
    const ctx = document.getElementById('liveChart').getContext('2d');
    
    // Membuat Gradient untuk area di bawah garis
    const fillGradient = ctx.createLinearGradient(0, 0, 0, 400);
    fillGradient.addColorStop(0, 'rgba(0, 212, 255, 0.25)');
    fillGradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historyData.map(item => item.waktu),
            datasets: [{
                data: historyData.map(item => item.suhu),
                borderColor: '#00d4ff',
                borderWidth: 3,
                tension: 0.4, // Membuat garis melengkung smooth
                fill: true,
                backgroundColor: fillGradient,
                
                // Styling Titik (Points)
                pointRadius: 4,
                pointBackgroundColor: '#00d4ff',
                pointBorderColor: 'rgba(0, 212, 255, 0.3)',
                pointBorderWidth: 8,
                hoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // CRITICAL: Matikan animasi default agar tidak lag
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { 
                        color: '#8a8f9d',
                        maxTicksLimit: 8 // Membatasi jumlah label agar tidak numpuk
                    }
                },
                y: {
                    min: 20, // Sesuaikan batas bawah suhu
                    max: 45, // Sesuaikan batas atas suhu
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: { color: '#8a8f9d' }
                }
            }
        },
        // Plugin untuk efek Glow Neon pada garis
        plugins: [{
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = 'rgba(0, 212, 255, 0.6)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 4;
            },
            afterDraw: (chart) => {
                chart.ctx.restore();
            }
        }]
    });

    /* =========================
       CORE FUNCTIONS
       ========================= */

    async function updateDashboard() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('ESP32 Offline');
            
            const data = await response.json();
            const suhuSekarang = data.suhu;
            const isHot = data.isHot;
            const waktuSekarang = new Date().toLocaleTimeString([], { hour12: false });

            // 1. Update Tampilan Angka & Status
            document.getElementById('temp-val').innerText = `${suhuSekarang.toFixed(1)}°C`;
            document.getElementById('avg-display').innerText = `${suhuSekarang.toFixed(1)}°C`;

            const statusBadge = document.getElementById('status-val');
            if (isHot) {
                statusBadge.innerText = "DANGER";
                statusBadge.style.color = "#ff4d4d";
                statusBadge.classList.add('neon-red'); // Jika ada CSS glow merah
            } else {
                statusBadge.innerText = "NORMAL";
                statusBadge.style.color = "#00ff9d";
            }

            // 2. Simpan ke History (Array & LocalStorage)
            historyData.push({ waktu: waktuSekarang, suhu: suhuSekarang });
            if (historyData.length > 50) historyData.shift(); // Simpan max 50 data
            
            localStorage.setItem('iotHistory', JSON.stringify(historyData));

            // 3. Update Chart secara instan
            chart.data.labels = historyData.map(d => d.waktu);
            chart.data.datasets[0].data = historyData.map(d => d.suhu);
            chart.update('none'); // 'none' mematikan animasi update agar enteng

            // 4. Update UI Pendukung
            renderTable();
            renderSummary();

        } catch (error) {
            console.error("Fetch Error:", error);
            document.getElementById('status-val').innerText = "DISCONNECTED";
            document.getElementById('status-val').style.color = "#8a8f9d";
        }
    }

    function renderTable() {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;

        // Ambil 10 data terakhir untuk tabel, tampilkan yang terbaru di atas
        const latestData = [...historyData].reverse().slice(0, 10);
        
        tbody.innerHTML = latestData.map(item => `
            <tr>
                <td>${item.waktu}</td>
                <td>${item.suhu.toFixed(1)}°C</td>
                <td><i class="fas fa-arrow-up-right" style="color: #00ff9d; font-size: 12px;"></i></td>
            </tr>
        `).join('');
    }

    function renderSummary() {
        if (historyData.length === 0) return;

        const temps = historyData.map(d => d.suhu);
        const avg = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2);
        const peak = Math.max(...temps).toFixed(1);
        const low = Math.min(...temps).toFixed(1);

        document.getElementById('stat-avg').innerText = `${avg}°C`;
        document.getElementById('stat-peak').innerText = `${peak}°C`;
        document.getElementById('stat-low').innerText = `${low}°C`;
    }

    /* =========================
       EXECUTION
       ========================= */
    
    // Jalankan render awal dari data LocalStorage
    renderTable();
    renderSummary();

    // Interval ambil data tiap 2.5 detik (sesuaikan dengan kecepatan ESP32)
    setInterval(updateDashboard, 2500);
    
    // Panggil pertama kali saat halaman dibuka
    updateDashboard();
});