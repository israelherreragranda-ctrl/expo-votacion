// ============================================================================
// SISTEMA DE VOTACIÓN - EXPO LOGÍSTICA UPEC 2026
// Versión: 2.0 - Sincronizada con Google Sheets
// ============================================================================

// Datos globales
let casosData = {};
let votosData = {};
let dispositivoId = generarIdDispositivo();
let votoEnProceso = null;
let graficos = {};

// CONFIGURACIÓN DE GOOGLE SHEETS
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRpD_EgbzXa7qhlfMbehCE8CJeg66iHDmVjo9TbEnxn8qVm_zdetW5lWPsamjSNDlh/exec';

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando Sistema de Votación...');
    cargarDatos();
    configurarTabs();
    inicializarLocalStorage();
    actualizarEstadisticas();
    sincronizarConNube();
    
    // Sincronizar cada 10 segundos
    setInterval(sincronizarConNube, 10000);
});

// ============================================================================
// GENERADOR DE ID DE DISPOSITIVO
// ============================================================================

function generarIdDispositivo() {
    let id = localStorage.getItem('dispositivoId');
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dispositivoId', id);
    }
    return id;
}

// ============================================================================
// CARGAR DATOS DE CASOS
// ============================================================================

async function cargarDatos() {
    try {
        const response = await fetch('casos_data.json');
        casosData = await response.json();
        console.log('✅ Datos de casos cargados correctamente');
        console.log('Junior:', casosData.junior?.length || 0, 'casos');
        console.log('Senior:', casosData.senior?.length || 0, 'casos');
        console.log('Posters:', casosData.posters?.length || 0, 'casos');
    } catch (error) {
        console.error('❌ Error al cargar casos_data.json:', error);
        casosData = { junior: [], senior: [], posters: [] };
    }
}

// ============================================================================
// CONFIGURAR TABS
// ============================================================================

function configurarTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            abrirTab(tabName);
        });
    });
}

function abrirTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    const tabElement = document.getElementById(tabName);
    if (tabElement) {
        tabElement.classList.add('active');
    }
    
    event.target.classList.add('active');
    
    if (tabName === 'resultados') {
        setTimeout(() => {
            actualizarResultados();
        }, 100);
    }
}

// ============================================================================
// INICIALIZAR LOCALSTORAGE
// ============================================================================

function inicializarLocalStorage() {
    if (!localStorage.getItem('votosData')) {
        const votosIniciales = {};
        
        if (casosData.junior) {
            casosData.junior.forEach(caso => {
                votosIniciales[caso.codigo] = {
                    votos: 0,
                    categoria: 'junior',
                    nombre: caso.nombre,
                    dispositivos: []
                };
            });
        }
        
        if (casosData.senior) {
            casosData.senior.forEach(caso => {
                votosIniciales[caso.codigo] = {
                    votos: 0,
                    categoria: 'senior',
                    nombre: caso.nombre,
                    dispositivos: []
                };
            });
        }
        
        if (casosData.posters) {
            casosData.posters.forEach(caso => {
                votosIniciales[caso.codigo] = {
                    votos: 0,
                    categoria: 'poster',
                    nombre: caso.nombre,
                    dispositivos: []
                };
            });
        }
        
        localStorage.setItem('votosData', JSON.stringify(votosIniciales));
    }
    votosData = JSON.parse(localStorage.getItem('votosData'));
}

// ============================================================================
// SINCRONIZACIÓN CON GOOGLE SHEETS
// ============================================================================

async function sincronizarConNube() {
    try {
        // Enviar datos a Google Sheets
        const filas = [['Código', 'Votos', 'Categoría', 'Nombre', 'Dispositivos']];
        
        for (let codigo in votosData) {
            const voto = votosData[codigo];
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
        
        console.log('✅ Datos sincronizados con Google Sheets');
        
    } catch (error) {
        console.error('Advertencia de sincronización:', error);
    }
}

// ============================================================================
// PROCESAR CÓDIGO QR (Manual o Escaneado)
// ============================================================================

function procesarCodigoQR(codigo) {
    console.log('🔍 Procesando código:', codigo);
    
    let casEncontrado = null;
    let categoria = null;

    // Buscar en todas las categorías
    for (let cat in casosData) {
        const key = cat === 'posters' ? 'posters' : cat;
        if (casosData[key]) {
            const caso = casosData[key].find(c => c.codigo === codigo);
            if (caso) {
                casEncontrado = caso;
                categoria = cat === 'posters' ? 'poster' : (cat === 'senior' ? 'senior' : 'junior');
                break;
            }
        }
    }

    if (!casEncontrado) {
        mostrarMensaje('❌ Código QR no válido: ' + codigo, 'error');
        return;
    }

    // Verificar si ya votó por esta categoría
    const votoAnterior = localStorage.getItem(`voto_${categoria}`);
    if (votoAnterior && votoAnterior !== codigo) {
        mostrarMensaje(`❌ Ya votaste por un caso ${categoria}. Solo puedes votar una vez por categoría.`, 'error');
        return;
    }

    // Verificar duplicados
    const votosActuales = votosData[codigo];
    if (votosActuales && votosActuales.dispositivos.includes(dispositivoId)) {
        mostrarMensaje(`❌ Ya has votado por este caso. No se permiten votos duplicados.`, 'error');
        return;
    }

    // Preparar voto
    votoEnProceso = {
        codigo: codigo,
        nombre: casEncontrado.nombre,
        categoria: categoria
    };

    // Mostrar modal de confirmación
    document.getElementById('detalleVoto').innerHTML = `
        <strong>Categoría:</strong> ${categoria.toUpperCase()}<br>
        <strong>Código:</strong> ${codigo}<br>
        <strong>Proyecto:</strong> ${casEncontrado.nombre}
    `;
    document.getElementById('modalVoto').classList.add('show');

    // Actualizar info
    document.getElementById('categoriaActual').textContent = categoria.toUpperCase();
    document.getElementById('casoActual').textContent = `${codigo} - ${casEncontrado.nombre}`;
    document.getElementById('estadoActual').textContent = 'Confirma tu voto';
}

// ============================================================================
// CONFIRMAR VOTO
// ============================================================================

function confirmarVoto() {
    if (!votoEnProceso) return;

    const { codigo, nombre, categoria } = votoEnProceso;

    // Crear entrada si no existe
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

    // Guardar en localStorage
    localStorage.setItem(`voto_${categoria}`, codigo);
    localStorage.setItem('votosData', JSON.stringify(votosData));

    mostrarMensaje(`✅ ¡Voto registrado! Gracias por votar por ${codigo}`, 'success');

    document.getElementById('modalVoto').classList.remove('show');
    votoEnProceso = null;
    document.getElementById('estadoActual').textContent = 'Voto registrado exitosamente';

    // Limpiar input
    const input = document.getElementById('codigoManual');
    if (input) input.value = '';

    // Sincronizar inmediatamente
    setTimeout(() => {
        sincronizarConNube();
        actualizarEstadisticas();
    }, 500);

    // Limpiar interfaz después
    setTimeout(() => {
        limpiarVoto();
    }, 2000);
}

// ============================================================================
// CANCELAR VOTO
// ============================================================================

function cancelarVoto() {
    document.getElementById('modalVoto').classList.remove('show');
    votoEnProceso = null;
}

// ============================================================================
// LIMPIAR VOTO
// ============================================================================

function limpiarVoto() {
    document.getElementById('categoriaActual').textContent = 'Ninguna';
    document.getElementById('casoActual').textContent = 'Esperando escaneo';
    document.getElementById('estadoActual').textContent = 'Listo para escanear';
    const msg = document.getElementById('mensaje');
    if (msg) msg.textContent = '';
}

// ============================================================================
// MOSTRAR MENSAJE
// ============================================================================

function mostrarMensaje(texto, tipo = 'info') {
    const msgElement = document.getElementById('mensaje');
    if (msgElement) {
        msgElement.textContent = texto;
        msgElement.className = `mensaje show ${tipo}`;
        
        setTimeout(() => {
            msgElement.classList.remove('show');
        }, 5000);
    }
}

// ============================================================================
// PROCESAR CÓDIGO MANUAL
// ============================================================================

function procesarCodigoManual() {
    const input = document.getElementById('codigoManual');
    if (!input) return;
    
    const codigo = input.value.trim().toUpperCase();
    if (codigo) {
        procesarCodigoQR(codigo);
    } else {
        mostrarMensaje('Por favor ingresa un código', 'error');
    }
}

// Event listener para Enter en input
document.addEventListener('DOMContentLoaded', () => {
    const codigoInput = document.getElementById('codigoManual');
    if (codigoInput) {
        codigoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                procesarCodigoManual();
            }
        });
    }
});

// ============================================================================
// SCANNER (función stub para compatibilidad)
// ============================================================================

function iniciarScanner() {
    mostrarMensaje('📷 Cámara preparada. Usa entrada manual para registrar votos.', 'info');
}

function detenerScanner() {
    console.log('⛔ Scanner detenido');
}

// ============================================================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================================================

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

    const updateElement = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    updateElement('totalVotos', totalVotos);
    updateElement('votosJunior', votosJunior);
    updateElement('votosSenior', votosSenior);
    updateElement('votosPosters', votosPosters);

    // Contar dispositivos únicos
    const dispositivos = new Set();
    for (let codigo in votosData) {
        votosData[codigo].dispositivos.forEach(d => dispositivos.add(d));
    }
    updateElement('totalDispositivos', dispositivos.size);
}

// ============================================================================
// ACTUALIZAR RESULTADOS (para tab de resultados)
// ============================================================================

function actualizarResultados() {
    crearGrafica('graficoJunior', calcularDatosCategoria('junior'), 'Casos Junior');
    crearGrafica('graficoSenior', calcularDatosCategoria('senior'), 'Casos Senior');
    crearGrafica('graficoPosters', calcularDatosCategoria('poster'), 'Posters');
}

function calcularDatosCategoria(categoria) {
    const key = categoria === 'poster' ? 'posters' : categoria;
    let casos = casosData[key] || [];
    
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

function crearGrafica(elementId, datosCategoria, titulo) {
    const ctx = document.getElementById(elementId);
    if (!ctx) return;

    if (graficos[elementId]) {
        graficos[elementId].destroy();
    }

    const datos = datosCategoria.datos;
    const colores = generarColores(datos.length);

    graficos[elementId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datos.map(d => d.codigo),
            datasets: [{
                label: 'Votos (%)',
                data: datos.map(d => d.porcentaje),
                backgroundColor: colores,
                borderColor: colores.map(c => c.replace('0.7', '1')),
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
                x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function generarColores(cantidad) {
    const coloresBase = [
        'rgba(102, 126, 234, 0.7)',
        'rgba(240, 124, 124, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(255, 193, 7, 0.7)',
        'rgba(156, 39, 176, 0.7)',
        'rgba(255, 87, 34, 0.7)',
        'rgba(33, 150, 243, 0.7)',
        'rgba(76, 175, 80, 0.7)',
        'rgba(233, 30, 99, 0.7)',
        'rgba(0, 150, 136, 0.7)'
    ];
    return coloresBase.slice(0, cantidad);
}

// ============================================================================
// EXPORTAR DATOS
// ============================================================================

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

// ============================================================================
// GENERAR QRs PARA IMPRESIÓN
// ============================================================================

function generarQRsParaImpresion() {
    mostrarMensaje('⏳ Generando QRs...', 'info');
    
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>QRs para Impresión</title>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
        <style>
            body { font-family: Arial; padding: 20px; background: white; }
            .qr-container { 
                page-break-inside: avoid;
                display: inline-block; 
                margin: 15px; 
                padding: 20px;
                border: 2px solid #ccc;
                text-align: center;
                width: 280px;
                background: white;
            }
            .qr-container h3 { margin: 10px 0; font-size: 18px; }
            .qr-container p { margin: 8px 0; font-size: 11px; line-height: 1.4; }
            .qr-box { margin: 15px auto; }
            .qr-box canvas { max-width: 100%; height: auto; }
            .categoria { font-weight: bold; padding: 8px 12px; border-radius: 3px; display: inline-block; margin-bottom: 10px; font-size: 12px; }
            .junior { background: #FFE699; }
            .senior { background: #B4C6E7; }
            .poster { background: #C5E0B4; }
            h1 { text-align: center; color: #1f4e78; }
            h2 { color: #1f4e78; margin: 40px 0 20px 0; border-bottom: 2px solid #1f4e78; padding-bottom: 10px; }
            .wrapper { display: flex; flex-wrap: wrap; justify-content: center; }
        </style>
    </head>
    <body>
        <h1>Códigos QR - Expo Logística UPEC 2026</h1>
    `;

    // Generar Junior
    html += '<h2>CASOS JUNIOR</h2><div class="wrapper">';
    if (casosData.junior) {
        casosData.junior.forEach((caso, idx) => {
            html += `
                <div class="qr-container">
                    <div class="categoria junior">JUNIOR</div>
                    <h3>${caso.codigo}</h3>
                    <p>${caso.nombre.substring(0, 45)}...</p>
                    <div class="qr-box" id="qr_junior_${idx}"></div>
                    <p style="margin-top: 10px; font-weight: bold;">${caso.codigo}</p>
                </div>
            `;
        });
    }
    html += '</div>';

    // Generar Senior
    html += '<h2>CASOS SENIOR</h2><div class="wrapper">';
    if (casosData.senior) {
        casosData.senior.forEach((caso, idx) => {
            html += `
                <div class="qr-container">
                    <div class="categoria senior">SENIOR</div>
                    <h3>${caso.codigo}</h3>
                    <p>${caso.nombre.substring(0, 45)}...</p>
                    <div class="qr-box" id="qr_senior_${idx}"></div>
                    <p style="margin-top: 10px; font-weight: bold;">${caso.codigo}</p>
                </div>
            `;
        });
    }
    html += '</div>';

    // Generar Posters
    html += '<h2>POSTERS</h2><div class="wrapper">';
    if (casosData.posters) {
        casosData.posters.forEach((caso, idx) => {
            html += `
                <div class="qr-container">
                    <div class="categoria poster">POSTER</div>
                    <h3>${caso.codigo}</h3>
                    <p>${caso.nombre.substring(0, 45)}...</p>
                    <div class="qr-box" id="qr_poster_${idx}"></div>
                    <p style="margin-top: 10px; font-weight: bold;">${caso.codigo}</p>
                </div>
            `;
        });
    }
    html += '</div></body></html>';

    const newWindow = window.open('', 'QRs', 'width=1400,height=900');
    newWindow.document.write(html);
    newWindow.document.close();

    setTimeout(() => {
        if (casosData.junior) {
            casosData.junior.forEach((caso, idx) => {
                try {
                    new QRCode(newWindow.document.getElementById(`qr_junior_${idx}`), {
                        text: caso.codigo,
                        width: 180,
                        height: 180,
                        colorDark: "#000000",
                        colorLight: "#ffffff"
                    });
                } catch (e) { console.log('Error QR:', e); }
            });
        }

        if (casosData.senior) {
            casosData.senior.forEach((caso, idx) => {
                try {
                    new QRCode(newWindow.document.getElementById(`qr_senior_${idx}`), {
                        text: caso.codigo,
                        width: 180,
                        height: 180,
                        colorDark: "#000000",
                        colorLight: "#ffffff"
                    });
                } catch (e) { console.log('Error QR:', e); }
            });
        }

        if (casosData.posters) {
            casosData.posters.forEach((caso, idx) => {
                try {
                    new QRCode(newWindow.document.getElementById(`qr_poster_${idx}`), {
                        text: caso.codigo,
                        width: 180,
                        height: 180,
                        colorDark: "#000000",
                        colorLight: "#ffffff"
                    });
                } catch (e) { console.log('Error QR:', e); }
            });
        }

        mostrarMensaje('✅ QRs generados. Imprime desde la nueva ventana (Ctrl+P)', 'success');
    }, 1500);
}

// ============================================================================
// LIMPIAR BASE DE DATOS (Solo en admin)
// ============================================================================

function limpiarBaseDatos() {
    if (confirm('⚠️ ¿Estás seguro? Esto borrará TODOS los votos registrados.')) {
        localStorage.removeItem('votosData');
        inicializarLocalStorage();
        actualizarEstadisticas();
        actualizarResultados();
        mostrarMensaje('✅ Base de datos limpiada', 'success');
    }
}

console.log('✅ Sistema de Votación cargado correctamente');

