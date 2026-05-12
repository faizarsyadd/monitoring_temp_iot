/* ============================================================
   IOT DASHBOARD - HOSPITAL MONITOR MODE (ULTRA-RESPONSIVE)
   ============================================================ */

const ESP32_IP = '192.168.1.9'; // SESUAIKAN IP ESP32 KAMU
const API_URL = `http://${ESP32_IP}/data`;

// Inisialisasi data (Gunakan data dummy awal agar chart tidak kosong saat load)
let historyData = JSON.parse(localStorage.getItem('iotHistory')) || [];

// Tunggu DOM (HTML) siap sepenuhnya
window.addEventListener('DOMContentLoaded', () => {
    const canvasElement = document.getElementById('liveChart');
    
    if (!canvasElement) {
        console.error("Elemen 'liveChart' tidak ditemukan di HTML!");
        return;
    }

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
                pointRadius: 0, // Mode EKG (tanpa titik bulat)
                pointHitRadius: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { display: false }
                },
                y: {
                    // MENGUBAH SCALE MENJADI DINAMIS
                    beginAtZero: false, 
                    suggestedMin: 25,    // Batas bawah minimal tetap 25
                    suggestedMax: 45,    // Jika suhu > 45, plafon akan otomatis naik sendiri
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)', 
                        drawBorder: false 
                    },
                    ticks: { 
                        color: '#8a8f9d',
                        // Menambahkan margin agar garis tidak mentok ke atas
                        padding: 10 
                    }
                }
            },
            // Menambahkan padding agar tren di ujung kanan/atas tidak terpotong
            layout: {
                padding: {
                    top: 20,
                    right: 20,
                    bottom: 10,
                    left: 10
                }
            }
        }
    });

    /* 2. FUNGSI UPDATE DATA */
    async function updateDashboard() {
        try {
            // Ambil data dari ESP32
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error("Offline");

            const data = await response.json();
            const suhu = data.suhu;
            const isHot = data.isHot;
            const waktu = new Date().toLocaleTimeString([], { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });

            // A. Update UI Teks
            document.getElementById('temp-val').innerText = `${suhu.toFixed(1)}°C`;
            document.getElementById('avg-display').innerText = `${suhu.toFixed(1)}°C`;
            const statusBadge = document.getElementById('status-val');

            // B. Mode Danger (Merah)
            if (isHot) {
                document.body.classList.add('danger-mode');
                statusBadge.innerText = "CRITICAL";
                statusBadge.className = "neon-red"; // Pastikan class ini ada di CSS
                chart.data.datasets[0].borderColor = '#ff4d4d';
                chart.data.datasets[0].backgroundColor = 'rgba(255, 77, 77, 0.1)';
            } else {
                document.body.classList.remove('danger-mode');
                statusBadge.innerText = "NORMAL";
                statusBadge.className = "neon-green";
                chart.data.datasets[0].borderColor = '#00d4ff';
                chart.data.datasets[0].backgroundColor = 'rgba(0, 212, 255, 0.05)';
            }

            // C. Update Array Data
            historyData.push({ waktu, suhu });
            if (historyData.length > 30) historyData.shift(); // Hanya simpan 30 titik terbaru di layar

            // D. Refresh Chart Instan
            chart.data.labels = historyData.map(d => d.waktu);
            chart.data.datasets[0].data = historyData.map(d => d.suhu);
            chart.update('none'); 

            // E. Update Tabel & Summary
            renderTable();
            updateSummary();

        } catch (err) {
            // Jika ESP32 mati, tampilkan status offline
            document.getElementById('status-val').innerText = "DISCONNECTED";
            document.getElementById('status-val').className = "neon-text";
        }
    }

    /* 3. FUNGSI PENDUKUNG */
    function renderTable() {
        const tbody = document.getElementById('historyBody');
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

        document.getElementById('stat-avg').innerText = `${avg}°C`;
        document.getElementById('stat-peak').innerText = `${peak}°C`;
        document.getElementById('stat-low').innerText = `${low}°C`;
    }

    // Jalankan interval tiap 1 detik (1000ms)
    setInterval(updateDashboard, 1000);
    updateDashboard();

    // Simpan ke storage tiap 10 detik agar tidak berat
    setInterval(() => {
        localStorage.setItem('iotHistory', JSON.stringify(historyData));
    }, 10000);
});