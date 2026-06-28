const API_URL = `http://${window.location.hostname}:8000`;

let state = {
    pagina: 1,
    filtro: 'todos',
    busqueda: '',
    por_pagina: 4
};

// Elements
const tbody = document.getElementById('documentTableBody');
const pagStart = document.getElementById('pagStart');
const pagEnd = document.getElementById('pagEnd');
const pagTotal = document.getElementById('pagTotal');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const pageNumbers = document.getElementById('pageNumbers');

const filterChips = document.querySelectorAll('.filter-chip');
const globalSearch = document.getElementById('globalSearch');
const tableSearch = document.getElementById('tableSearch');

// Modal Elements
const modal = document.getElementById('modalNuevoDocumento');
const btnNuevo = document.getElementById('btnNuevoDocumento');
const btnCerrar = document.getElementById('btnCerrarModal');
const btnCancelar = document.getElementById('btnCancelarModal');
const formNuevo = document.getElementById('formNuevoDocumento');
const selectAutor = document.getElementById('selectAutor');
const selectCategoria = document.getElementById('selectCategoria');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchAutores();
    fetchCategoriasParaModal();
    fetchDocumentos();
    setupEventListeners();
});

function setupEventListeners() {
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            state.filtro = e.target.dataset.filtro;
            state.busqueda = '';
            if (globalSearch) globalSearch.value = '';
            if (tableSearch) tableSearch.value = '';
            state.pagina = 1;
            updateChipsUI();
            fetchDocumentos();
        });
    });

    [globalSearch, tableSearch].forEach(input => {
        if (!input) return;
        input.addEventListener('input', debounce((e) => {
            state.busqueda = e.target.value;
            state.pagina = 1;
            fetchDocumentos();
        }, 500));
    });

    btnPrevPage.addEventListener('click', () => {
        if (state.pagina > 1) {
            state.pagina--;
            fetchDocumentos();
        }
    });

    btnNextPage.addEventListener('click', () => {
        state.pagina++;
        fetchDocumentos();
    });

    // Modal
    btnNuevo.addEventListener('click', () => {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    });
    btnCerrar.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });
    btnCancelar.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    });

    formNuevo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('inputFile');
        if (!fileInput.files.length) return;

        const titulo = document.getElementById('inputTitulo').value.trim();
        if (!titulo) {
            alert('El título es obligatorio');
            return;
        }

        const formData = new FormData();
        formData.append('archivo', fileInput.files[0]);
        formData.append('titulo', titulo);
        formData.append('descripcion', document.getElementById('inputDescripcion').value);
        formData.append('autor_id', document.getElementById('selectAutor').value);
        const anio = document.getElementById('inputAnioCreacion').value;
        if (anio) formData.append('anio_creacion', anio);
        const categoriaId = document.getElementById('selectCategoria').value;
        if (categoriaId) formData.append('categoria_id', categoriaId);
        // El estado siempre se envía como "completado": el selector está
        // deshabilitado en la interfaz y no debe poder cambiarse.
        formData.append('estado', 'completado');
        formData.append('prioridad', document.getElementById('selectPrioridad').value);

        try {
            const res = await fetch(`${API_URL}/documentos`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                formNuevo.reset();
                state.pagina = 1;
                fetchDocumentos();
            } else {
                alert("Error al subir documento");
            }
        } catch (error) {
            console.error("Upload error", error);
            alert("Error de conexión al subir documento");
        }
    });
}

function updateChipsUI() {
    filterChips.forEach(chip => {
        if (chip.dataset.filtro === state.filtro) {
            chip.className = "filter-chip px-4 py-1.5 rounded-full bg-primary text-on-primary text-label-md font-bold shadow-sm whitespace-nowrap";
        } else {
            chip.className = "filter-chip px-4 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-all text-label-md font-medium whitespace-nowrap";
        }
    });
}

async function fetchAutores() {
    try {
        const res = await fetch(`${API_URL}/usuarios`);
        const usuarios = await res.json();
        selectAutor.innerHTML = usuarios.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('');
    } catch (e) {
        console.error("Error fetching usuarios", e);
    }
}

async function fetchCategoriasParaModal() {
    if (!selectCategoria) return;
    try {
        const res = await fetch(`${API_URL}/categorias`);
        const categorias = await res.json();
        selectCategoria.innerHTML = '<option value="">Sin clasificación</option>' +
            categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } catch (e) {
        console.error("Error fetching categorias", e);
    }
}

async function fetchDocumentos() {
    try {
        let url;
        if (state.busqueda.trim() !== '') {
            url = `${API_URL}/documentos/buscar?q=${encodeURIComponent(state.busqueda)}`;
        } else {
            url = `${API_URL}/documentos?filtro=${state.filtro}&pagina=${state.pagina}&por_pagina=${state.por_pagina}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (state.busqueda.trim() !== '') {
            // endpoint de busqueda no devuelve meta de paginacion, solo lista
            renderTable(data, data.length, 1, data.length);
        } else {
            renderTable(data.items, data.total, data.pagina, data.por_pagina);
        }
    } catch (error) {
        console.error("Error fetching documentos:", error);
    }
}

function renderTable(items, total, pagina, por_pagina) {
    tbody.innerHTML = '';
    
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-on-surface-variant">No se encontraron documentos</td></tr>';
        updatePagination(0, 0, 0);
        return;
    }

    items.forEach(doc => {
        const row = document.createElement('tr');
        row.className = "hover:bg-surface-container-lowest group transition-colors";
        
        // Colors mapping
        let estadoColor = "bg-gray-100 text-gray-800 border-gray-200";
        if (doc.estado === "completado") estadoColor = "bg-green-100 text-green-800 border-green-200";
        if (doc.estado === "pendiente") estadoColor = "bg-amber-100 text-amber-800 border-amber-200";
        if (doc.estado === "en_revision") estadoColor = "bg-blue-100 text-blue-800 border-blue-200";

        // "Fecha de Subida" = fecha_creacion (momento en que se subió el archivo al sistema).
        let fechaSubidaFormatted = new Date(doc.fecha_creacion).toLocaleDateString('es-ES', {day: '2-digit', month: 'short', year: 'numeric'});
        // "Fecha de Creación" = año de creación indicado al subir el documento.
        let fechaCreacionTexto = doc.anio_creacion ? doc.anio_creacion : '—';

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded bg-primary-container/10 flex items-center justify-center">
                        <span class="material-symbols-outlined text-primary">${doc.icono || 'description'}</span>
                    </div>
                    <div>
                        <div class="text-body-md font-bold text-on-surface">${doc.nombre}</div>
                        <div class="text-label-sm text-on-surface-variant">Folio: ${doc.folio}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${estadoColor}">
                    ${doc.estado.charAt(0).toUpperCase() + doc.estado.slice(1).replace('_', ' ')}
                </span>
            </td>
            <td class="px-6 py-4 text-body-md text-on-surface-variant">${fechaSubidaFormatted}</td>
            <td class="px-6 py-4 text-body-md text-on-surface-variant">${fechaCreacionTexto}</td>
            <td class="px-6 py-4">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-primary">${doc.autor_iniciales}</div>
                    <span class="text-body-md text-on-surface">${doc.autor_nombre}</span>
                </div>
            </td>
            <td class="px-6 py-4 text-right space-x-1">
                <button onclick="verDoc('${doc.folio}')" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-all" title="Visualizar">
                    <span class="material-symbols-outlined text-[20px]">visibility</span>
                </button>
                <button onclick="downloadDoc('${doc.folio}')" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-all" title="Descargar">
                    <span class="material-symbols-outlined text-[20px]">download</span>
                </button>
                <button onclick="deleteDoc('${doc.folio}')" class="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-all" title="Eliminar">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updatePagination(total, pagina, por_pagina, items.length);
}

function updatePagination(total, pagina, por_pagina, itemsCount) {
    if (total === 0) {
        pagStart.textContent = '0';
        pagEnd.textContent = '0';
        pagTotal.textContent = '0';
        btnPrevPage.disabled = true;
        btnNextPage.disabled = true;
        pageNumbers.innerHTML = '';
        return;
    }

    const start = (pagina - 1) * por_pagina + 1;
    const end = start + itemsCount - 1;
    
    pagStart.textContent = start;
    pagEnd.textContent = end;
    pagTotal.textContent = total;

    btnPrevPage.disabled = pagina === 1;
    const maxPages = Math.ceil(total / por_pagina);
    btnNextPage.disabled = pagina >= maxPages;

    pageNumbers.innerHTML = '';
    // Limit to 5 page numbers for simple UI
    for(let i=1; i<=maxPages; i++) {
        const btn = document.createElement('button');
        if (i === pagina) {
            btn.className = "px-3 py-1 text-label-md font-bold bg-primary text-white rounded";
        } else {
            btn.className = "px-3 py-1 text-label-md hover:bg-surface-container-highest rounded transition-colors";
            btn.onclick = () => { state.pagina = i; fetchDocumentos(); };
        }
        btn.textContent = i;
        pageNumbers.appendChild(btn);
    }
}

window.downloadDoc = function(folio) {
    // Abre directamente el nuevo endpoint que sirve el archivo como stream
    window.open(`${API_URL}/documentos/${folio}/descargar`, '_blank');
}

window.verDoc = function(folio) {
    // Abre el documento en una nueva pestaña para visualizarlo (sin forzar descarga)
    window.open(`${API_URL}/documentos/${folio}/ver`, '_blank');
}

window.deleteDoc = async function(folio) {
    if(!confirm('¿Seguro que deseas eliminar este documento?')) return;
    try {
        const res = await fetch(`${API_URL}/documentos/${folio}`, { method: 'DELETE' });
        if(res.ok) {
            fetchDocumentos();
        } else {
            alert('Error al eliminar el documento');
        }
    } catch(e) {
        console.error(e);
        alert('Error de conexión');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
