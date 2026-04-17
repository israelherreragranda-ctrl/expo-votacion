// Datos globales
let casosData = {};
let votosData = {};
let dispositivoId = generarIdDispositivo();
let html5QrcodeScanner = null;
let votoEnProceso = null;
let graficos = {};

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    cargarDatos();
    configurarTabs();
    configurarFiltros();
    inicializarLocalStorage();
    actualizarEstadisticas();
    actualizarResultados();
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
        console.log('Datos cargados:', casosData);
    } catch (error) {
        console.error('Error al cargar datos:', error);
        // Usar datos de fallback
        casosData = {
            junior: [],
            senior: [],
            posters: []
        };
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

// Configurar tabs
function configurarTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            abrirTab(tabName);
        });
    });
}

// Abrir tab
function abrirTab(tabName) {
    // Ocultar todos los tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Remover clase active de botones
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    // Mostrar tab seleccionado
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
    
    // Actualizar resultados cuando se abre la pestaña
    if (tabName === 'resultados') {
        setTimeout(() => {
            actualizarResultados();
        }, 100);
    }
}

// Iniciar scanner
function iniciarScanner() {
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
    };

    html5QrcodeScanner = new Html5Qrcode("html5-qr-code");
    
    html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        mostrarMensaje('Error al iniciar cámara: ' + err, 'error');
    });

    mostrarMensaje('Cámara iniciada. Apunta a un código QR.', 'info');
}

// Callback cuando se escanea un QR
function onScanSuccess(decodedText, decodedResult) {
    console.log('QR escaneado:', decodedText);
    procesarCodigoQR(decodedText.trim());
}

function onScanFailure(error) {
    // Silenciar errores de lectura
}

// Procesar código QR escaneado
function procesarCodigoQR(codigo) {
    // Detener scanner temporalmente
    if (html5QrcodeScanner) {
        html5QrcodeScanner.pause(true);
    }

    // Buscar el caso
    let casEncontrado = null;
    let categoria = null;

    for (let cat in casosData) {
        const caso = casosData[cat].find(c => c.codigo === codigo);
        if (caso) {
            casEncontrado = caso;
            categoria = cat.slice(0, -1); // junior, senior, poster
            break;
        }
    }

    if (!casEncontrado) {
        mostrarMensaje('❌ Código QR no válido', 'error');
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
        return;
    }

    // Verificar si ya votó por esta categoría
    const votoAnterior = localStorage.getItem(`voto_${categoria}`);
    if (votoAnterior && votoAnterior !== codigo) {
        mostrarMensaje(`❌ Ya votaste por un caso ${categoria}. Solo puedes votar una vez por categoría.`, 'error');
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
        return;
    }

    // Verificar si ya votó por este caso específico desde este dispositivo
    const votosActuales = votosData[codigo];
    if (votosActuales.dispositivos.includes(dispositivoId)) {
        mostrarMensaje(`❌ Ya has votado por este caso. No se permiten votos duplicados.`, 'error');
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
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

    // Actualizar info box
    document.getElementById('categoriaActual').textContent = categoria.toUpperCase();
    document.getElementById('casoActual').textContent = `${codigo} - ${casEncontrado.nombre}`;
    document.getElementById('estadoActual').textContent = 'Confirma tu voto';
}

// Confirmar voto
function confirmarVoto() {
    if (!votoEnProceso) return;

    const { codigo, nombre, categoria } = votoEnProceso;

    // Registrar el voto
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

    // Registrar el voto anterior para esta categoría
    localStorage.setItem(`voto_${categoria}`, codigo);

    // Guardar en localStorage
    localStorage.setItem('votosData', JSON.stringify(votosData));

    // Mostrar mensaje de éxito
    mostrarMensaje(`✅ ¡Voto registrado! Gracias por votar por ${codigo}`, 'success');

    // Cerrar modal
    document.getElementById('modalVoto').classList.remove('show');

    // Limpiar
    votoEnProceso = null;
    document.getElementById('estadoActual').textContent = 'Voto registrado exitosamente';

    // Reanudar scanner después de 2 segundos
    setTimeout(() => {
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
        limpiarVoto();
    }, 2000);

    // Actualizar estadísticas
    actualizarEstadisticas();
}

// Cancelar voto
function cancelarVoto() {
    document.getElementById('modalVoto').classList.remove('show');
    votoEnProceso = null;
    
    if (html5QrcodeScanner) {
        html5QrcodeScanner.resume();
    }
}

// Detener scanner
function detenerScanner() {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().catch(err => {
            console.error('Error al detener scanner:', err);
        });
    }
    mostrarMensaje('Cámara detenida', 'info');
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
    msgElement.textContent = texto;
    msgElement.className = `mensaje ${tipo}`;
    
    setTimeout(() => {
        msgElement.textContent = '';
        msgElement.className = 'mensaje';
    }, 5000);
}

// Configurar filtros
function configurarFiltros() {
    const filtros = document.querySelectorAll('input[name="categoria-filtro"]');
    filtros.forEach(filtro => {
        filtro.addEventListener('change', actualizarResultados);
    });
}

// Actualizar resultados
function actualizarResultados() {
    const categoriaSeleccionada = document.querySelector('input[name="categoria-filtro"]:checked').value;
    
    // Calcular datos para gráficas
    const datosGraficas = {
        junior: calcularDatosCategoria('junior'),
        senior: calcularDatosCategoria('senior'),
        poster: calcularDatosCategoria('poster')
    };

    // Crear gráficas
    crearGrafica('graficoJunior', datosGraficas.junior, 'Casos Junior');
    crearGrafica('graficoSenior', datosGraficas.senior, 'Casos Senior');
    crearGrafica('graficoPosters', datosGraficas.poster, 'Posters');

    // Mostrar estadísticas
    mostrarEstadisticas('statsJunior', datosGraficas.junior);
    mostrarEstadisticas('statsSenior', datosGraficas.senior);
    mostrarEstadisticas('statsPosters', datosGraficas.poster);

    // Actualizar tabla
    actualizarTabla(categoriaSeleccionada);
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

    // Calcular porcentajes
    datos.forEach(dato => {
        dato.porcentaje = totalVotos > 0 ? ((dato.votos / totalVotos) * 100).toFixed(1) : 0;
    });

    // Ordenar por votos descendentes y tomar top 10
    datos.sort((a, b) => b.votos - a.votos);
    
    return {
        datos: datos.slice(0, 10),
        totalVotos: totalVotos
    };
}

// Crear gráfica de barras
function crearGrafica(elementId, datosCategoria, titulo) {
    const ctx = document.getElementById(elementId);
    if (!ctx) return;

    const datos = datosCategoria.datos;
    const colores = generarColores(datos.length);

    // Destruir gráfica anterior si existe
    if (graficos[elementId]) {
        graficos[elementId].destroy();
    }

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
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: titulo
                }
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

// Generar colores para gráficas
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

// Mostrar estadísticas
function mostrarEstadisticas(elementId, datosCategoria) {
    const element = document.getElementById(elementId);
    if (!element) return;

    let html = '';
    datosCategoria.datos.forEach(dato => {
        html += `
            <div class="stat-item">
                <span>${dato.codigo}</span>
                <span>${dato.votos} votos (${dato.porcentaje}%)</span>
            </div>
        `;
    });

    element.innerHTML = html;
}

// Actualizar tabla de votos
function actualizarTabla(categoriaFiltro) {
    const tbody = document.querySelector('.tabla-votos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    let casos = [];
    
    if (categoriaFiltro === 'todos') {
        casos = [
            ...casosData.junior.map(c => ({ ...c, categoria: 'junior' })),
            ...casosData.senior.map(c => ({ ...c, categoria: 'senior' })),
            ...casosData.posters.map(c => ({ ...c, categoria: 'poster' }))
        ];
    } else {
        const key = categoriaFiltro === 'poster' ? 'posters' : categoriaFiltro;
        casos = casosData[key].map(c => ({ ...c, categoria: categoriaFiltro }));
    }

    casos.forEach(caso => {
        const voto = votosData[caso.codigo] || { votos: 0 };
        
        // Calcular porcentaje
        const totalCategoria = calcularDatosCategoria(caso.categoria).totalVotos;
        const porcentaje = totalCategoria > 0 ? ((voto.votos / totalCategoria) * 100).toFixed(1) : '0.0';

        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${caso.codigo}</td>
            <td>${caso.nombre}</td>
            <td><strong>${caso.categoria.toUpperCase()}</strong></td>
            <td>${voto.votos}</td>
            <td>${porcentaje}%</td>
        `;
    });
}

// Actualizar estadísticas generales
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

    document.getElementById('totalVotos').textContent = totalVotos;
    document.getElementById('votosJunior').textContent = votosJunior;
    document.getElementById('votosSenior').textContent = votosSenior;
    document.getElementById('votosPosters').textContent = votosPosters;

    // Contar dispositivos únicos
    const dispositivos = new Set();
    for (let codigo in votosData) {
        votosData[codigo].dispositivos.forEach(d => dispositivos.add(d));
    }
    document.getElementById('totalDispositivos').textContent = dispositivos.size;
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

// Limpiar base de datos
function limpiarBaseDatos() {
    if (confirm('⚠️ ¿Estás seguro? Esto borrará todos los votos registrados.')) {
        localStorage.removeItem('votosData');
        inicializarLocalStorage();
        actualizarEstadisticas();
        actualizarResultados();
        mostrarMensaje('✅ Base de datos limpiada', 'success');
    }
}

// Generar QRs para impresión
function generarQRsParaImpresion() {
    mostrarMensaje('⏳ Generando QRs... Por favor espera.', 'info');
    
    // Crear un documento para descargar con todos los QRs
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>QRs para Impresión - Expo Logística UPEC 2026</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .qr-container { 
                page-break-inside: avoid;
                display: inline-block; 
                margin: 10px; 
                padding: 15px;
                border: 2px solid #ccc;
                text-align: center;
                width: 250px;
            }
            .qr-container h3 { margin: 0 0 10px 0; }
            .qr-container p { margin: 10px 0; font-size: 12px; }
            .qr-container img { width: 200px; height: 200px; }
            .categoria { 
                font-weight: bold; 
                padding: 5px 10px; 
                border-radius: 3px;
                display: inline-block;
                margin-bottom: 10px;
            }
            .junior { background: #FFE699; }
            .senior { background: #B4C6E7; }
            .poster { background: #C5E0B4; }
            h1 { text-align: center; color: #1f4e78; }
            h2 { color: #1f4e78; margin-top: 30px; border-bottom: 2px solid #1f4e78; }
            .wrapper { display: flex; flex-wrap: wrap; justify-content: center; }
        </style>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    </head>
    <body>
        <h1>Códigos QR para la Expo Logística y Transporte UPEC 2026</h1>
    `;

    // CASOS JUNIOR
    html += '<h2>CASOS JUNIOR</h2><div class="wrapper">';
    casosData.junior.forEach((caso, idx) => {
        const qrValue = caso.codigo;
        html += `
            <div class="qr-container">
                <div class="categoria junior">JUNIOR</div>
                <h3>${caso.codigo}</h3>
                <p style="font-size: 11px; line-height: 1.3;">${caso.nombre.substring(0, 50)}...</p>
                <div id="qr_junior_${idx}"></div>
                <p style="margin-top: 10px; font-weight: bold;">${qrValue}</p>
            </div>
        `;
    });
    html += '</div>';

    // CASOS SENIOR
    html += '<h2>CASOS SENIOR</h2><div class="wrapper">';
    casosData.senior.forEach((caso, idx) => {
        const qrValue = caso.codigo;
        html += `
            <div class="qr-container">
                <div class="categoria senior">SENIOR</div>
                <h3>${caso.codigo}</h3>
                <p style="font-size: 11px; line-height: 1.3;">${caso.nombre.substring(0, 50)}...</p>
                <div id="qr_senior_${idx}"></div>
                <p style="margin-top: 10px; font-weight: bold;">${qrValue}</p>
            </div>
        `;
    });
    html += '</div>';

    // POSTERS
    html += '<h2>POSTERS</h2><div class="wrapper">';
    casosData.posters.forEach((caso, idx) => {
        const qrValue = caso.codigo;
        html += `
            <div class="qr-container">
                <div class="categoria poster">POSTER</div>
                <h3>${caso.codigo}</h3>
                <p style="font-size: 11px; line-height: 1.3;">${caso.nombre.substring(0, 50)}...</p>
                <div id="qr_poster_${idx}"></div>
                <p style="margin-top: 10px; font-weight: bold;">${qrValue}</p>
            </div>
        `;
    });
    html += '</div>';

    html += '</body></html>';

    // Crear ventana nueva y generar QRs
    const newWindow = window.open('', '', 'width=1200,height=800');
    newWindow.document.write(html);
    newWindow.document.close();

    // Generar QRs en la nueva ventana
    setTimeout(() => {
        casosData.junior.forEach((caso, idx) => {
            const element = newWindow.document.getElementById(`qr_junior_${idx}`);
            if (element) new QRCode(element, { text: caso.codigo, width: 200, height: 200 });
        });

        casosData.senior.forEach((caso, idx) => {
            const element = newWindow.document.getElementById(`qr_senior_${idx}`);
            if (element) new QRCode(element, { text: caso.codigo, width: 200, height: 200 });
        });

        casosData.posters.forEach((caso, idx) => {
            const element = newWindow.document.getElementById(`qr_poster_${idx}`);
            if (element) new QRCode(element, { text: caso.codigo, width: 200, height: 200 });
        });

        mostrarMensaje('✅ QRs generados. Imprime desde la nueva ventana (Ctrl+P)', 'success');
    }, 500);
}
