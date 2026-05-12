const ESP32_IP =
'192.168.1.9';

/* =========================
   LOCAL STORAGE
========================= */

let historyData =
JSON.parse(
  localStorage.getItem(
    'iotHistory'
  )
) || [];

/* =========================
   CHART
========================= */

const ctx =
document.getElementById('chart');

const chart =
new Chart(ctx, {

  type:'line',

  data:{

    labels:
    historyData.map(
      item => item.waktu
    ),

    datasets:[{

      label:'Temperature °C',

      data:
      historyData.map(
        item => item.suhu
      ),

      borderColor:'#00d4ff',

      borderWidth:3,

      tension:0.4,

      fill:true,

      backgroundColor:
      'rgba(0,212,255,0.12)',

      pointRadius:4,

      pointHoverRadius:6
    }]
  },

  options:{

    responsive:true,

    maintainAspectRatio:false,

    plugins:{

      legend:{
        labels:{
          color:'white'
        }
      }
    },

    scales:{

      x:{
        ticks:{
          color:'white'
        }
      },

      y:{

        beginAtZero:false,

        ticks:{
          color:'white'
        }
      }
    }
  }
});

/* =========================
   FETCH DATA
========================= */

async function getData(){

  try{

    const response =
    await fetch(
      `http://${ESP32_IP}/data`
    );

    if(!response.ok){

      throw new Error(
        'ESP32 ERROR'
      );
    }

    const data =
    await response.json();

    /* TEMPERATURE */

    document
    .getElementById('temp')
    .innerHTML =
    data.suhu + '°C';

    /* STATUS */

    const status =
    document
    .getElementById('status');

    if(data.isHot){

      status.innerHTML =
      'OVERHEAT';

      status.style.color =
      '#ff4d4d';

    }else{

      status.innerHTML =
      'NORMAL';

      status.style.color =
      '#00ff99';
    }

    /* TIME */

    const time =
    new Date()
    .toLocaleTimeString();

    /* SAVE HISTORY */

    historyData.push({

      suhu:data.suhu,
      waktu:time
    });

    /* LIMIT DATA */

    if(historyData.length > 50){

      historyData.shift();
    }

    /* SAVE STORAGE */

    localStorage.setItem(

      'iotHistory',

      JSON.stringify(
        historyData
      )
    );

    /* UPDATE CHART */

    chart.data.labels =
    historyData.map(
      item => item.waktu
    );

    chart.data.datasets[0]
    .data =
    historyData.map(
      item => item.suhu
    );

    chart.update();

    updateHistory();

    updateAverage();

  }catch(error){

    console.log(error);

    const status =
    document.getElementById(
      'status'
    );

    status.innerHTML =
    'DISCONNECTED';

    status.style.color =
    '#ff4d4d';
  }
}

/* =========================
   HISTORY
========================= */

function updateHistory(){

  const history =
  document.getElementById(
    'history'
  );

  history.innerHTML = '';

  historyData
  .slice(-10)
  .reverse()
  .forEach(item=>{

    history.innerHTML += `

    <div class="history-item">

      <span>
        ${item.waktu}
      </span>

      <span>
        ${item.suhu}°C
      </span>

    </div>

    `;
  });
}

/* =========================
   AVERAGE
========================= */

function updateAverage(){

  if(historyData.length === 0)
  return;

  const total =
  historyData.reduce(

    (sum,item)=>

    sum + item.suhu,

    0
  );

  const avg =
  total / historyData.length;

  document
  .getElementById('avg')
  .innerHTML =
  avg.toFixed(1) + '°C';
}

/* =========================
   INITIAL LOAD
========================= */

updateHistory();

updateAverage();

setInterval(
  getData,
  3000
);

getData();