// Configuración de Google Sheets
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRpD_EgbzXa7qhlfMbehCE8CJeg66iHDmVjo9TbEnxn8qVm_zdetW5lWPsamjSNDlh/exec';

// Datos globales
let casosData = {};
let votosData = {};
let dispositivoId = generarIdDispositivo();

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicativo...');
    cargarDatos();
    inicializarLocalStorage();
    sincronizarConNube();
});

// Generar ID dispositivo
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
        console.log('✅ Datos cargados:', casosData);
    } catch (error) {
        console.error('❌ Error al cargar datos:', error);
    }
}

// Inicializar LocalStorage
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
        console.log('✅ Votos inicializados');
    }
    votosData = JSON.parse(localStorage.getItem('votosData'));
    console.log('✅ Datos cargados en memoria:', votosData);
}

// Sincronizar con nube
async function sincronizarConNube() {
    try {
        // Enviar datos a la nube
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
        
        console.log('✅ Datos enviados a Google Sheets');
        
    } catch (error) {
        console.error('Error de sincronización:', error);
    }
}

// Procesar código QR/manual
function procesarCodigoQR(codigo) {
    console.log('🔍 Buscando código:', codigo);
    console.log('Datos disponibles:', casosData);
    
    let casEncontrado = null;
    let categoria = null;

    // Buscar en junior
    if (casosData.junior) {
        const caso = casosData.junior.find(c => c.codigo === codigo);
        if (caso) {
            casEncontrado = caso;
            categoria = 'junior';
        }
    }

    // Buscar en senior
    if (!casEncontrado && casosData.senior) {
        const caso = casosData.senior.find(c => c.codigo === codigo);
        if (caso) {
            casEncontrado = caso;
            categoria = 'senior';
        }
    }

    // Buscar en posters
    if (!casEncontrado && casosData.posters) {
        const caso = casosData.posters.find(c => c.codigo === codigo);
        if (caso) {
            casEncontrado = caso;
            categoria = 'poster';
        }
    }

    console.log('Caso encontrado:', casEncontrado);
    console.log('Categoría:', categoria);

    if (!casEncontrado) {
        mostrarMensaje('❌ Código no válido: ' + codigo, 'error');
        return;
    }

    // Verificar si ya votó por esta categoría
    const votoAnterior = localStorage.getItem(`voto_${categoria}`);
    if (votoAnterior && votoAnterior !== codigo) {
        mostrarMensaje(`❌ Ya votaste por un caso ${categoria}`, 'error');
        return;
    }

    // Verificar duplicados
    if (votosData[codigo] && votosData[codigo].dispositivos.includes(dispositivoId)) {
        mostrarMensaje(`❌ Ya has votado por este caso`, 'error');
        return;
    }

    // Mostrar modal de confirmación
    document.getElementById('detalleVoto').innerHTML = `
        <strong>Categoría:</strong> ${categoria.toUpperCase()}<br>
        <strong>Código:</strong> ${codigo}<br>
        <strong>Proyecto:</strong> ${casEncontrado.nombre}
    `;
    document.getElementById('modalVoto').classList.add('show');
    
    // Guardar para confirmar después
    window.votoEnProceso = {
        codigo: codigo,
        nombre: casEncontrado.nombre,
        categoria: categoria
    };
    
    document.getElementById('categoriaActual').textContent = categoria.toUpperCase();
    document.getElementById('casoActual').textContent = `${codigo} - ${casEncontrado.nombre}`;
}

// Confirmar voto
function confirmarVoto() {
    if (!window.votoEnProceso) return;

    const { codigo, nombre, categoria } = window.votoEnProceso;

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

    mostrarMensaje(`✅ ¡Voto registrado para ${codigo}!`, 'success');

    document.getElementById('modalVoto').classList.remove('show');
    document.getElementById('codigoManual').value = '';
    
    // Sincronizar
    setTimeout(sincronizarConNube, 1000);
}

// Cancelar voto
function cancelarVoto() {
    document.getElementById('modalVoto').classList.remove('show');
    window.votoEnProceso = null;
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

// Procesar código manual
function procesarCodigoManual() {
    const codigo = document.getElementById('codigoManual').value.trim().toUpperCase();
    console.log('Código ingresado:', codigo);
    if (codigo) {
        procesarCodigoQR(codigo);
    } else {
        mostrarMensaje('Por favor ingresa un código', 'error');
    }
}

// Enter en input
if (document.getElementById('codigoManual')) {
    document.getElementById('codigoManual').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            procesarCodigoManual();
        }
    });
}

// Funciones stub para compatibilidad
function iniciarScanner() {
    mostrarMensaje('Función de cámara no disponible, usa entrada manual', 'info');
}

function detenerScanner() {
    console.log('Scanner detenido');
}

function actualizarResultados() {
    console.log('Actualizando resultados...');
}

function actualizarEstadisticas() {
    console.log('Actualizando estadísticas...');
}

function exportarDatos() {
    const datos = {
        timestamp: new Date().toISOString(),
        votosData: votosData
    };
    const dataStr = JSON.stringify(datos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `votos_${new Date().getTime()}.json`;
    link.click();
}

function generarQRsParaImpresion() {
    mostrarMensaje('Función no disponible', 'info');
}

// Sincronizar cada 10 segundos
setInterval(sincronizarConNube, 10000);

