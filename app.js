// Datos globales
let casosData = {};
let votosData = {};
let dispositivoId = generarIdDispositivo();
let votoEnProceso = null;
let graficos = {};

// CONFIGURACIÓN DE GOOGLE SHEETS
const GOOGLE_SHEET_ID = '1O2Cp2V2wPrEQ1bSRkdVaLNMA_HxfW4aKALLreTY3YDE';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRpD_EgbzXa7qhlfMbehCE8CJeg66iHDmVjo9TbEnxn8qVm_zdetW5lWPsamjSNDlh/exec';

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    cargarDatos();
    inicializarLocalStorage();
    sincronizarConNube();
    actualizarEstadisticas();
    actualizarResultados();
    
    // Sincronizar cada 10 segundos
    setInterval(sincronizarConNube, 10000);
});

// Generar ID único para cada dispositivo
function generarIdDispositivo() {
    let id = localStorage.getItem('dispositivoId');
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dispositivoId', id);
    }
    return id;
}

// Cargar datos de casos
async function cargarDatos() {
    try {
        const response = await fetch('casos_data.json');
        casosData = await response.json();
        console.log('✅ Datos de casos cargados');
    } catch (error) {
        console.error('Error al cargar datos:', error);
        casosData = { junior: [], senior: [], posters: [] };
    }
}

// Inicializar LocalStorage
function inicializarLocalStorage() {
    if (!localStorage.getItem('votosData')) {
        const votosIniciales = {};
        
        casosData.junior.forEach(caso => {
            votosIniciales[caso.codigo] = {
                votos: 0,
                categoria: 'junior',
                nombre: caso.nombre,
                dispositivos: []
            };
        });
        
        casosData.senior.forEach(caso => {
            votosIniciales[caso.codigo] = {
                votos: 0,
                categoria: 'senior',
                nombre: caso.nombre,
                dispositivos: []
            };
        });
        
        casosData.posters.forEach(caso => {
            votosIniciales[caso.codigo] = {
                votos: 0,
                categoria: 'poster',
                nombre: caso.nombre,
                dispositivos: []
            };
        });
        
        localStorage.setItem('votosData', JSON.stringify(votosIniciales));
    }
    votosData = JSON.parse(localStorage.getItem('votosData'));
}

// SINCRONIZACIÓN CON GOOGLE SHEETS
async function sincronizarConNube() {
    try {
        // Leer datos de la nube
        const datosNube = await leerDatosNube();
        
        if (datosNube && Object.keys(datosNube).length > 0) {
            // Fusionar datos: nube tiene prioridad
            votosData = { ...votosData, ...datosNube };
            localStorage.setItem('votosData', JSON.stringify(votosData));
            actualizarEstadisticas();
            actualizarResultados();
            console.log('✅ Datos sincronizados desde la nube');
        }
        
        // Enviar datos locales a la nube
        await enviarDatosNube(votosData);
        
    } catch (error) {
        console.error('Error de sincronización:', error);
    }
}

// Leer datos de Google Sheets
async function leerDatosNube() {
    try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL);
        const datos = await response.json();
        
        if (Array.isArray(datos) && datos.length > 0) {
            const votosNube = {};
            
            // Convertir array a objeto
            for (let i = 1; i < datos.length; i++) {
                const fila = datos[i];
                if (fila[0]) {
                    votosNube[fila[0]] = {
                        votos: parseInt(fila[1]) || 0,
                        categoria: fila[2] || '',
                        nombre: fila[3] || '',
                        dispositivos: fila[4] ? JSON.parse(fila[4]) : []
                    };
                }
            }
            
            return votosNube;
        }
        
        return {};
        
    } catch (error) {
        console.error('Error al leer de la nube:', error);
        return {};
    }
}

// Enviar datos a Google Sheets
async function enviarDatosNube(datos) {
    try {
        const filas = [['Código', 'Votos', 'Categoría', 'Nombre', 'Dispositivos']];
        
        for (let codigo in datos) {
            const voto = datos[codigo];
            filas.push([
                codigo,
                voto.votos,
                voto.categoria,
                voto.nombre,
                JSON.stringify(voto.dispositivos)
            ]);
        }
        
        await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(filas)
        });
        
        console.log('✅ Datos enviados a la nube');
        
    } catch (error) {
        console.error('Error al enviar a la nube:', error);
    }
}

// Procesar código QR
function procesarCodigoQR(codigo) {
    console.log('Procesando código:', codigo);

    let casEncontrado = null;
    let categoria = null;

    for (let cat in casosData) {
        const caso = casosData[cat].find(c => c.codigo === codigo);
        if (caso) {
            casEncontrado = caso;
            categoria = cat.slice(0, -1);
            break;
        }
    }

    if (!casEncontrado) {
        mostrarMensaje('❌ Código QR no válido', 'error');
        return;
    }

    const votoAnterior = localStorage.getItem(`voto_${categoria}`);
    if (votoAnterior && votoAnterior !== codigo) {
        mostrarMensaje(`❌ Ya votaste por un caso ${categoria}. Solo una vez por categoría.`, 'error');
        return;
    }

    const votosActuales = votosData[codigo];
    if (votosActuales && votosActuales.dispositivos.includes(dispositivoId)) {
        mostrarMensaje(`❌ Ya has votado por este caso.`, 'error');
        return;
    }

    votoEnProceso = {
        codigo: codigo,
        nombre: casEncontrado.nombre,
        categoria: categoria
    };

    document.getElementById('detalleVoto').innerHTML = `
        <strong>Categoría:</strong> ${categoria.toUpperCase()}<br>
        <strong>Código:</strong> ${codigo}<br>
        <strong>Proyecto:</strong> ${casEncontrado.nombre}
    `;
    document.getElementById('modalVoto').classList.add('show');

    document.getElementById('categoriaActual').textContent = categoria.toUpperCase();
    document.getElementById('casoActual').textContent = `${codigo} - ${casEncontrado.nombre}`;
    document.getElementById('estadoActual').textContent = 'Confirma tu voto';
}

// Confirmar voto
function confirmarVoto() {
    if (!votoEnProceso) return;

    const { codigo, nombre, categoria } = votoEnProceso;

    if (!votosData[codigo]) {
        votosData[codigo] = {
            votos: 0,
            categoria: categoria,
            nombre: nombre,
            dispositivos: []
        };
    }

    votosData[codigo].votos++;
    votosData[codigo].dispositivos.push(dispositivoId);
    localStorage.setItem(`voto_${categoria}`, codigo);
    localStorage.setItem('votosData', JSON.stringify(votosData));

    mostrarMensaje(`✅ ¡Voto registrado! Gracias por votar por ${codigo}`, 'success');

    document.getElementById('modalVoto').classList.remove('show');
    votoEnProceso = null;
    document.getElementById('estadoActual').textContent = 'Voto registrado exitosamente';

    setTimeout(() => {
        limpiarVoto();
        sincronizarConNube();
    }, 2000);

    actualizarEstadisticas();
}

// Cancelar voto
function cancelarVoto() {
    document.getElementById('modalVoto').classList.remove('show');
    votoEnProceso = null;
}

// Limpiar voto
function limpiarVoto() {
    document.getElementById('categoriaActual').textContent = 'Ninguna';
    document.getElementById('casoActual').textContent = 'Esperando escaneo';
    document.getElementById('estadoActual').textContent = 'Listo para escanear';
    document.getElementById('mensaje').textContent = '';
}

// Mostrar mensaje
function mostrarMensaje(texto, tipo = 'info') {
    const msgElement = document.getElementById('mensaje');
    if (msgElement) {
        msgElement.textContent = texto;
        msgElement.className = `mensaje show ${tipo}`;
        
        setTimeout(() => {
            msgElement.classList.remove('show');
        }, 4000);
    }
}

// Actualizar estadísticas
function actualizarEstadisticas() {
    let totalVotos = 0;
    let votosJunior = 0;
    let votosSenior = 0;
    let votosPosters = 0;

    for (let codigo in votosData) {
        const voto = votosData[codigo];
        totalVotos += voto.votos;
        
        if (voto.categoria === 'junior') votosJunior += voto.votos;
        else if (voto.categoria === 'senior') votosSenior += voto.votos;
        else if (voto.categoria === 'poster') votosPosters += voto.votos;
    }

    const totalVotosEl = document.getElementById('totalVotos');
    if (totalVotosEl) totalVotosEl.textContent = totalVotos;
    
    const votosJuniorEl = document.getElementById('votosJunior');
    if (votosJuniorEl) votosJuniorEl.textContent = votosJunior;
    
    const votosSeniorEl = document.getElementById('votosSenior');
    if (votosSeniorEl) votosSeniorEl.textContent = votosSenior;
    
    const votosPosEl = document.getElementById('votosPosters');
    if (votosPosEl) votosPosEl.textContent = votosPosters;

    const dispositivos = new Set();
    for (let codigo in votosData) {
        votosData[codigo].dispositivos.forEach(d => dispositivos.add(d));
    }
    
    const dispEl = document.getElementById('totalDispositivos');
    if (dispEl) dispEl.textContent = dispositivos.size;
}

// Actualizar resultados
function actualizarResultados() {
    crearGrafica('graficoJunior', calcularDatosCategoria('junior'), 'Casos Junior');
    crearGrafica('graficoSenior', calcularDatosCategoria('senior'), 'Casos Senior');
    crearGrafica('graficoPosters', calcularDatosCategoria('poster'), 'Posters');
}

// Calcular datos para una categoría
function calcularDatosCategoria(categoria) {
    let casos = casosData[categoria === 'poster' ? 'posters' : categoria] || [];
    
    let totalVotos = 0;
    const datos = casos.map(caso => {
        const voto = votosData[caso.codigo] || { votos: 0 };
        totalVotos += voto.votos;
        return {
            codigo: caso.codigo,
            nombre: caso.nombre,
            votos: voto.votos
        };
    });

    datos.forEach(dato => {
        dato.porcentaje = totalVotos > 0 ? ((dato.votos / totalVotos) * 100).toFixed(1) : 0;
    });

    datos.sort((a, b) => b.votos - a.votos);
    
    return {
        datos: datos.slice(0, 10),
        totalVotos: totalVotos
    };
}

// Crear gráfica
function crearGrafica(elementId, datosCategoria, titulo) {
    const ctx = document.getElementById(elementId);
    if (!ctx) return;

    if (graficos[elementId]) {
        graficos[elementId].destroy();
    }

    const datos = datosCategoria.datos;
    const colores = ['#667eea', '#48bb78', '#ed8936'];
    const color = elementId.includes('Junior') ? colores[0] : elementId.includes('Senior') ? colores[1] : colores[2];

    graficos[elementId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datos.map(d => d.codigo),
            datasets: [{
                label: 'Votos',
                data: datos.map(d => d.votos),
                backgroundColor: color,
                borderColor: color,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                title: { display: true, text: titulo }
            },
            scales: {
                x: { beginAtZero: true }
            }
        }
    });
}

// Exportar datos
function exportarDatos() {
    const datos = {
        timestamp: new Date().toISOString(),
        votosData: votosData,
        resumen: {
            totalVotos: Object.values(votosData).reduce((sum, v) => sum + v.votos, 0),
            dispositivosUnicos: new Set(
                Object.values(votosData).flatMap(v => v.dispositivos)
            ).size
        }
    };

    const dataStr = JSON.stringify(datos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `votos_expo_${new Date().getTime()}.json`;
    link.click();

    mostrarMensaje('✅ Datos exportados exitosamente', 'success');
}

// Generar QRs para impresión
function generarQRsParaImpresion() {
    mostrarMensaje('⏳ Generando QRs...', 'info');
    
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>QRs para Impresión</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
        <style>
            body { font-family: Arial; padding: 20px; }
            .qr-container { 
                page-break-inside: avoid;
                display: inline-block; 
                margin: 15px; 
                padding: 20px;
                border: 2px solid #ccc;
                text-align: center;
                width: 280px;
            }
            .qr-container h3 { margin: 10px 0; font-size: 18px; }
            .qr-container p { margin: 8px 0; font-size: 11px; }
            .qr-box { margin: 15px auto; }
            .qr-box canvas { max-width: 100%; }
            .categoria { font-weight: bold; padding: 8px 12px; border-radius: 3px; display: inline-block; margin-bottom: 10px; font-size: 12px; }
            .junior { background: #FFE699; }
            .senior { background: #B4C6E7; }
            .poster { background: #C5E0B4; }
            h1 { text-align: center; color: #1f4e78; }
            h2 { color: #1f4e78; margin-top: 30px; border-bottom: 2px solid #1f4e78; }
            .wrapper { display: flex; flex-wrap: wrap; justify-content: center; }
        </style>
    </head>
    <body>
        <h1>Códigos QR - Expo Logística UPEC 2026</h1>
    `;

    html += '<h2>CASOS JUNIOR</h2><div class="wrapper">';
    casosData.junior.forEach((caso, idx) => {
        html += `
            <div class="qr-container">
                <div class="categoria junior">JUNIOR</div>
                <h3>${caso.codigo}</h3>
                <p>${caso.nombre.substring(0, 45)}...</p>
                <div class="qr-box" id="qr_junior_${idx}"></div>
                <p style="font-weight: bold;">${caso.codigo}</p>
            </div>
        `;
    });
    html += '</div>';

    html += '<h2>CASOS SENIOR</h2><div class="wrapper">';
    casosData.senior.forEach((caso, idx) => {
        html += `
            <div class="qr-container">
                <div class="categoria senior">SENIOR</div>
                <h3>${caso.codigo}</h3>
                <p>${caso.nombre.substring(0, 45)}...</p>
                <div class="qr-box" id="qr_senior_${idx}"></div>
                <p style="font-weight: bold;">${caso.codigo}</p>
            </div>
        `;
    });
    html += '</div>';

    html += '<h2>POSTERS</h2><div class="wrapper">';
    casosData.posters.forEach((caso, idx) => {
        html += `
            <div class="qr-container">
                <div class="categoria poster">POSTER</div>
                <h3>${caso.codigo}</h3>
                <p>${caso.nombre.substring(0, 45)}...</p>
                <div class="qr-box" id="qr_poster_${idx}"></div>
                <p style="font-weight: bold;">${caso.codigo}</p>
            </div>
        `;
    });
    html += '</div></body></html>';

    const newWindow = window.open('', '', 'width=1400,height=900');
    newWindow.document.write(html);
    newWindow.document.close();

    setTimeout(() => {
        casosData.junior.forEach((caso, idx) => {
            new QRCode(newWindow.document.getElementById(`qr_junior_${idx}`), {
                text: caso.codigo,
                width: 180,
                height: 180
            });
        });

        casosData.senior.forEach((caso, idx) => {
            new QRCode(newWindow.document.getElementById(`qr_senior_${idx}`), {
                text: caso.codigo,
                width: 180,
                height: 180
            });
        });

        casosData.posters.forEach((caso, idx) => {
            new QRCode(newWindow.document.getElementById(`qr_poster_${idx}`), {
                text: caso.codigo,
                width: 180,
                height: 180
            });
        });

        mostrarMensaje('✅ QRs generados. Imprime desde la nueva ventana (Ctrl+P)', 'success');
    }, 1000);
}
