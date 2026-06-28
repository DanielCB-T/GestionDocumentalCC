const API_URL = `http://${window.location.hostname}:8000`;
const searchInput = document.getElementById('searchInputMain');
const searchResults = document.getElementById('searchResults');

document.addEventListener('DOMContentLoaded', () => {
    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length === 0) {
            searchResults.innerHTML = '<div class="text-center text-on-surface-variant mt-10">Comienza a escribir para buscar documentos.</div>';
            return;
        }
        
        searchResults.innerHTML = '<div class="text-center text-on-surface-variant mt-10">Buscando...</div>';
        try {
            const res = await fetch(`${API_URL}/documentos/buscar?q=${encodeURIComponent(query)}`);
            if (!res.ok) throw new Error("Error en red");
            const data = await res.json();
            renderResults(data);
        } catch (error) {
            searchResults.innerHTML = '<div class="text-center text-error mt-10">Error al realizar la búsqueda.</div>';
        }
    }, 500));
});

function renderResults(items) {
    if (items.length === 0) {
        searchResults.innerHTML = '<div class="text-center text-on-surface-variant mt-10">No se encontraron resultados.</div>';
        return;
    }
    
    searchResults.innerHTML = '';
    items.forEach(doc => {
        const dateFormatted = new Date(doc.fecha_creacion).toLocaleDateString('es-ES', {day: '2-digit', month: 'short', year: 'numeric'});
        
        const card = document.createElement('div');
        card.className = "bg-surface-container-lowest p-4 rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow flex items-center justify-between";
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded bg-primary-container/10 flex items-center justify-center">
                    <span class="material-symbols-outlined text-primary text-[28px]">${doc.icono || 'description'}</span>
                </div>
                <div>
                    <h3 class="text-body-lg font-bold text-on-surface">${doc.nombre}</h3>
                    <p class="text-label-sm text-on-surface-variant">Folio: ${doc.folio} • Autor: ${doc.autor_nombre} • Fecha: ${dateFormatted}</p>
                </div>
            </div>
            <div>
                <button onclick="downloadDoc('${doc.folio}')" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-all" title="Descargar">
                    <span class="material-symbols-outlined text-[24px]">download</span>
                </button>
            </div>
        `;
        searchResults.appendChild(card);
    });
}

window.downloadDoc = function(folio) {
    window.open(`${API_URL}/documentos/${folio}/descargar`, '_blank');
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
