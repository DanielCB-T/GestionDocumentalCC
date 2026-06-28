const API_URL = `http://${window.location.hostname}:8000`;

// Vistas
const categoriasContainer = document.getElementById('categoriasContainer');
const gridContainer = document.getElementById('gridContainer');
const gridSort = document.getElementById('gridSort');
const explorerTitle = document.getElementById('explorerTitle');
const explorerSubtitle = document.getElementById('explorerSubtitle');

// Botones de navegación
const btnNuevaCategoria = document.getElementById('btnNuevaCategoria');
const btnVolverCategorias = document.getElementById('btnVolverCategorias');

// Modal crear categoría
const modalCategoria = document.getElementById('modalNuevaCategoria');
const btnCerrarModalCategoria = document.getElementById('btnCerrarModalCategoria');
const btnCancelarModalCategoria = document.getElementById('btnCancelarModalCategoria');
const formNuevaCategoria = document.getElementById('formNuevaCategoria');

let categoriaActual = null; // { id, nombre } cuando estamos dentro de una carpeta

document.addEventListener('DOMContentLoaded', () => {
    fetchCategorias();

    gridSort.addEventListener('change', () => {
        if (categoriaActual) fetchDocumentosDeCategoria(categoriaActual.id, gridSort.value);
    });

    btnVolverCategorias.addEventListener('click', mostrarVistaCategorias);

    btnNuevaCategoria.addEventListener('click', () => {
        modalCategoria.classList.remove('hidden');
        modalCategoria.classList.add('flex');
    });
    btnCerrarModalCategoria.addEventListener('click', cerrarModalCategoria);
    btnCancelarModalCategoria.addEventListener('click', cerrarModalCategoria);

    formNuevaCategoria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('inputNombreCategoria').value.trim();
        if (!nombre) return;

        try {
            const res = await fetch(`${API_URL}/categorias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre })
            });
            if (res.ok) {
                cerrarModalCategoria();
                formNuevaCategoria.reset();
                fetchCategorias();
            } else if (res.status === 409) {
                alert('Ya existe una categoría con ese nombre');
            } else {
                alert('Error al crear la categoría');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión al crear la categoría');
        }
    });
});

function cerrarModalCategoria() {
    modalCategoria.classList.add('hidden');
    modalCategoria.classList.remove('flex');
}

function mostrarVistaCategorias() {
    categoriaActual = null;
    categoriasContainer.classList.remove('hidden');
    gridContainer.classList.add('hidden');
    gridSort.classList.add('hidden');
    btnVolverCategorias.classList.add('hidden');
    btnVolverCategorias.classList.remove('flex');
    btnNuevaCategoria.classList.remove('hidden');
    explorerTitle.textContent = 'Explorador de Documentos';
    explorerSubtitle.textContent = 'Categorías de documentos. Selecciona una para ver sus archivos.';
    fetchCategorias();
}

function mostrarVistaDocumentos(categoria) {
    categoriaActual = categoria;
    categoriasContainer.classList.add('hidden');
    gridContainer.classList.remove('hidden');
    gridSort.classList.remove('hidden');
    btnVolverCategorias.classList.remove('hidden');
    btnVolverCategorias.classList.add('flex');
    explorerTitle.textContent = categoria.nombre;
    explorerSubtitle.textContent = 'Documentos clasificados en esta categoría.';
    fetchDocumentosDeCategoria(categoria.id, gridSort.value);
}

async function fetchCategorias() {
    categoriasContainer.innerHTML = '<div class="col-span-full text-center py-10 text-on-surface-variant">Cargando categorías...</div>';
    try {
        const res = await fetch(`${API_URL}/categorias`);
        const categorias = await res.json();
        renderCategorias(categorias);
    } catch (e) {
        categoriasContainer.innerHTML = '<div class="col-span-full text-center py-10 text-error">Error al cargar las categorías</div>';
    }
}

function renderCategorias(categorias) {
    if (!categorias || categorias.length === 0) {
        categoriasContainer.innerHTML = '<div class="col-span-full text-center py-10 text-on-surface-variant">Todavía no hay categorías. Crea la primera con el botón "Crear categoría".</div>';
        return;
    }

    categoriasContainer.innerHTML = '';
    categorias.forEach(cat => {
        const card = document.createElement('div');
        card.className = "bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col items-center group cursor-pointer";
        card.innerHTML = `
            <div class="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center mb-4">
                <span class="material-symbols-outlined text-primary text-[40px]">${cat.icono || 'folder'}</span>
            </div>
            <h3 class="text-body-md font-bold text-on-surface text-center line-clamp-2 w-full mb-1" title="${cat.nombre}">${cat.nombre}</h3>
            <span class="text-label-sm text-on-surface-variant">${cat.total_documentos} documento${cat.total_documentos === 1 ? '' : 's'}</span>
        `;
        card.addEventListener('click', () => mostrarVistaDocumentos(cat));
        categoriasContainer.appendChild(card);
    });
}

async function fetchDocumentosDeCategoria(categoriaId, order = 'recientes') {
    gridContainer.innerHTML = '<div class="col-span-full text-center py-10 text-on-surface-variant">Cargando...</div>';
    try {
        const res = await fetch(`${API_URL}/categorias/${categoriaId}/documentos`);
        if (!res.ok) throw new Error('Error en red');
        let items = await res.json();

        if (order === 'antiguos') {
            items.reverse();
        }

        renderGrid(items);
    } catch (e) {
        gridContainer.innerHTML = '<div class="col-span-full text-center py-10 text-error">Error al cargar documentos</div>';
    }
}

function renderGrid(items) {
    if (items.length === 0) {
        gridContainer.innerHTML = '<div class="col-span-full text-center py-10 text-on-surface-variant">No hay documentos en esta categoría</div>';
        return;
    }
    
    gridContainer.innerHTML = '';
    items.forEach(doc => {
        let estadoColor = "bg-gray-100 text-gray-800";
        if (doc.estado === "completado") estadoColor = "bg-green-100 text-green-800";
        if (doc.estado === "pendiente") estadoColor = "bg-amber-100 text-amber-800";
        if (doc.estado === "en_revision") estadoColor = "bg-blue-100 text-blue-800";
        
        const card = document.createElement('div');
        card.className = "bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col items-center group cursor-pointer relative";
        
        // Botones de acción visibles al pasar el mouse (visualizar / descargar)
        card.innerHTML = `
            <div class="absolute top-3 right-3 flex gap-1">
                <button onclick="verDoc('${doc.folio}'); event.stopPropagation();" class="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-all" title="Visualizar">
                    <span class="material-symbols-outlined text-[20px]">visibility</span>
                </button>
                <button onclick="downloadDoc('${doc.folio}'); event.stopPropagation();" class="opacity-0 group-hover:opacity-100 p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-all" title="Descargar">
                    <span class="material-symbols-outlined text-[20px]">download</span>
                </button>
            </div>
            <div class="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center mb-4 mt-2">
                <span class="material-symbols-outlined text-primary text-[40px]">${doc.icono || 'description'}</span>
            </div>
            <h3 class="text-body-md font-bold text-on-surface text-center line-clamp-2 w-full mb-1" title="${doc.nombre}">${doc.nombre}</h3>
            <div class="text-label-sm text-on-surface-variant mb-3">${doc.folio}</div>
            
            <span class="mt-auto px-3 py-1 rounded-full text-[10px] font-bold ${estadoColor}">
                ${doc.estado.charAt(0).toUpperCase() + doc.estado.slice(1).replace('_', ' ')}
            </span>
        `;
        gridContainer.appendChild(card);
    });
}

window.downloadDoc = function(folio) {
    window.open(`${API_URL}/documentos/${folio}/descargar`, '_blank');
}

window.verDoc = function(folio) {
    window.open(`${API_URL}/documentos/${folio}/ver`, '_blank');
}
