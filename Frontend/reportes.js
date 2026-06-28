const API_URL = `http://${window.location.hostname}:8000`;

document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndDrawCharts();
});

async function fetchDataAndDrawCharts() {
    try {
        // Pedir un número alto para traer "todos" los documentos y hacer estadisticas (en un escenario real esto se haría en backend)
        const res = await fetch(`${API_URL}/documentos?por_pagina=100`);
        const data = await res.json();
        const items = data.items;
        
        drawEstadoChart(items);
        drawPrioridadChart(items);
        drawCategoriaChart(items);
    } catch (e) {
        console.error("Error fetching data for charts", e);
    }
}

function drawEstadoChart(items) {
    const counts = {
        completado: 0,
        pendiente: 0,
        en_revision: 0,
        archivado: 0
    };
    
    items.forEach(doc => {
        if (counts[doc.estado] !== undefined) {
            counts[doc.estado]++;
        }
    });
    
    const ctx = document.getElementById('estadoChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completado', 'Pendiente', 'En Revisión', 'Archivado'],
            datasets: [{
                data: [counts.completado, counts.pendiente, counts.en_revision, counts.archivado],
                backgroundColor: [
                    '#16a34a', // green
                    '#d97706', // amber
                    '#2563eb', // blue
                    '#6b7280'  // gray
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Inter' } }
                }
            }
        }
    });
}

function drawPrioridadChart(items) {
    const counts = {
        baja: 0,
        normal: 0,
        alta: 0,
        critica: 0
    };
    
    items.forEach(doc => {
        if (counts[doc.prioridad] !== undefined) {
            counts[doc.prioridad]++;
        }
    });
    
    const ctx = document.getElementById('prioridadChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Baja', 'Normal', 'Alta', 'Crítica'],
            datasets: [{
                label: 'Cantidad de Documentos',
                data: [counts.baja, counts.normal, counts.alta, counts.critica],
                backgroundColor: [
                    '#9ca3af', // gray
                    '#3b82f6', // blue
                    '#ea580c', // orange
                    '#dc2626'  // red
                ],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}

// Paleta cíclica para que cada categoría tenga un color distinto sin
// importar cuántas categorías existan.
const PALETA_CATEGORIAS = [
    '#0c56d0', '#16a34a', '#d97706', '#9333ea',
    '#dc2626', '#0891b2', '#65a30d', '#db2777'
];

function drawCategoriaChart(items) {
    const counts = {};

    items.forEach(doc => {
        const nombre = doc.categoria_nombre || 'Sin clasificación';
        counts[nombre] = (counts[nombre] || 0) + 1;
    });

    const labels = Object.keys(counts);
    const data = labels.map(l => counts[l]);
    const colores = labels.map((_, i) => PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length]);

    const ctx = document.getElementById('categoriaChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cantidad de Documentos',
                data: data,
                backgroundColor: colores,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                }
            }
        }
    });
}
