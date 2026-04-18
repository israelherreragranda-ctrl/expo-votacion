// URL de Google Apps Script (URL NUEVA)
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJai_6moSJq_OOz5gL2osCbxTZ2JU-pDgoSaLJO9GFaxh9-G30w_pf7qWpjkCwy/exec';

let casosData = {};
let yaVoto = false;

// Inicializar cuando cargue la página
document.addEventListener('DOMContentLoaded', async function() {
    // Cargar datos de casos
    try {
        const response = await fetch('casos_data.json');
        casosData = await response.json();
        console.log('✅ Datos cargados');
    } catch (error) {
        console.error('Error al cargar datos:', error);
        mostrarMensaje('Error al cargar los casos', 'error');
        return;
    }

    // Verificar si ya votó
    if (localStorage.getItem('yaVoto')) {
        yaVoto = true;
        mostrarBloqueado();
        return;
    }

    // Llenar dropdowns
    llenarDropdown('junior', casosData.junior);
    llenarDropdown('senior', casosData.senior);
    llenarDropdown('poster', casosData.posters);

    // Habilitar botón cuando seleccione los 3
    ['junior', 'senior', 'poster'].forEach(id => {
        document.getElementById(id).addEventListener('change', validarSeleccion);
    });
});

// Llenar un dropdown con opciones
function llenarDropdown(id, casos) {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="">-- Selecciona un caso --</option>';
    
    casos.forEach(caso => {
        const option = document.createElement('option');
        option.value = caso.codigo;
        option.textContent = `${caso.codigo} - ${caso.nombre}`;
        select.appendChild(option);
    });

    select.disabled = false;
}

// Validar que haya seleccionado los 3
function validarSeleccion() {
    const junior = document.getElementById('junior').value;
    const senior = document.getElementById('senior').value;
    const poster = document.getElementById('poster').value;
    
    const btnVotar = document.getElementById('btnVotar');
    if (junior && senior && poster) {
        btnVotar.disabled = false;
    } else {
        btnVotar.disabled = true;
    }
}

// Registrar el voto
async function registrarVoto() {
    const junior = document.getElementById('junior').value;
    const senior = document.getElementById('senior').value;
    const poster = document.getElementById('poster').value;

    if (!junior || !senior || !poster) {
        mostrarMensaje('❌ Selecciona un caso de cada categoría', 'error');
        return;
    }

    // Deshabilitar botón
    const btnVotar = document.getElementById('btnVotar');
    btnVotar.disabled = true;
    btnVotar.innerHTML = '<div class="cargando"><div class="spinner"></div> Registrando...</div>';

    try {
        // Preparar datos
        const ahora = new Date();
        const timestamp = ahora.toLocaleString('es-ES');
        const dispositivoId = obtenerIdDispositivo();

        const datos = {
            timestamp: timestamp,
            junior: junior,
            senior: senior,
            poster: poster,
            dispositivo: dispositivoId
        };

        // Enviar a Google Sheets
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(datos)
        });

        if (!response.ok) {
            throw new Error('Error en la respuesta del servidor');
        }

        // Marcar como votado
        localStorage.setItem('yaVoto', 'true');
        yaVoto = true;

        // Mostrar mensaje de éxito
        mostrarMensaje('✅ ¡Votos registrados correctamente!', 'success');

        // Bloquear después de 2 segundos
        setTimeout(() => {
            mostrarBloqueado();
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('❌ Error al registrar los votos. Intenta de nuevo.', 'error');
        btnVotar.disabled = false;
        btnVotar.innerHTML = '✓ REGISTRAR MIS VOTOS';
    }
}

// Mostrar pantalla bloqueada
function mostrarBloqueado() {
    document.getElementById('formulario').style.display = 'none';
    document.getElementById('bloqueado').style.display = 'block';
}

// Mostrar mensaje
function mostrarMensaje(texto, tipo = 'info') {
    const msgElement = document.getElementById('mensaje');
    msgElement.textContent = texto;
    msgElement.className = `mensaje show ${tipo}`;
    
    setTimeout(() => {
        msgElement.classList.remove('show');
    }, 5000);
}

// Obtener ID único del dispositivo
function obtenerIdDispositivo() {
    let id = localStorage.getItem('dispositivoId');
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('dispositivoId', id);
    }
    return id;
}


