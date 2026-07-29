// Main Weight Tracker Interactions

document.addEventListener('DOMContentLoaded', () => {
    // 1. Real-time Weight Input Parser
    setupWeightParser();

    // 2. Toggle custom date/time fields
    setupDatePickerToggle();

    // 3. Initialize Weight History Chart (Chart.js)
    setupWeightChart();
    
    // 4. Flash Message Auto-dismissal
    setupFlashDismiss();
});

/**
 * Setup real-time feedback on weight input formatting
 */
function setupWeightParser() {
    const weightInput = document.getElementById('weight');
    const weightPreview = document.getElementById('weight-preview-tip');
    
    if (!weightInput || !weightPreview) return;

    const parseAndPreview = () => {
        let valStr = weightInput.value.trim().replace(',', '.');
        
        if (!valStr) {
            weightPreview.innerHTML = '';
            return;
        }

        let parsed = null;
        
        if (valStr.includes('.')) {
            parsed = parseFloat(valStr);
        } else if (/^\d+$/.test(valStr)) {
            const valInt = parseInt(valStr, 10);
            if (valStr.length >= 3) {
                parsed = valInt / 10.0;
            } else {
                parsed = parseFloat(valInt);
            }
        }

        if (parsed !== null && !isNaN(parsed)) {
            weightPreview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Se guardará como: <strong>${parsed.toFixed(1)} kg</strong>`;
            weightPreview.style.color = 'var(--color-accent)';
        } else {
            weightPreview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Formato no válido`;
            weightPreview.style.color = 'var(--color-danger)';
        }
    };

    weightInput.addEventListener('input', parseAndPreview);
    // Trigger on load in case browser prefilled the input
    parseAndPreview();
}

/**
 * Collapsible Custom Date/Time Toggle
 */
function setupDatePickerToggle() {
    const toggleBtn = document.getElementById('toggle-date-btn');
    const container = document.getElementById('custom-date-container');
    const dateInput = document.getElementById('custom_date');
    const timeInput = document.getElementById('custom_time');

    if (!toggleBtn || !container) return;

    toggleBtn.addEventListener('click', () => {
        const isOpen = container.classList.contains('open');
        if (isOpen) {
            container.classList.remove('open');
            toggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Definir fecha/hora manual
            `;
            // Clear values to submit current server time
            if (dateInput) dateInput.value = '';
            if (timeInput) timeInput.value = '';
        } else {
            container.classList.add('open');
            toggleBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                Usar hora actual
            `;
            
            // Auto fill current date & time if empty
            if (dateInput && !dateInput.value) {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}`;
            }
            if (timeInput && !timeInput.value) {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                timeInput.value = `${hours}:${minutes}`;
            }
        }
    });
}

/**
 * Setup and render history line chart using Chart.js
 */
function setupWeightChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;

    // Retrieve data injected in HTML script tag
    const chartDataElement = document.getElementById('chart-data');
    if (!chartDataElement) return;

    let chartData = [];
    try {
        chartData = JSON.parse(chartDataElement.textContent);
    } catch (e) {
        console.error("Failed to parse chart data", e);
        return;
    }

    if (chartData.length === 0) {
        // Hide chart card or display message if no data
        return;
    }

    // Sort chart data chronologically (oldest first) for correct graph flow
    chartData.sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = chartData.map(d => {
        const dateObj = new Date(d.date);
        return dateObj.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    });
    const values = chartData.map(d => d.weight);

    // Gradient fill beneath line
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: values,
                borderColor: '#6366f1',
                borderWidth: 3,
                pointBackgroundColor: '#a855f7',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.35,
                fill: true,
                backgroundColor: gradient
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#e5e7eb',
                    borderColor: 'rgba(99, 102, 241, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.parsed.y.toFixed(1)} kg`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#9ca3af',
                        font: {
                            family: 'Outfit'
                        },
                        callback: function(value) {
                            return value + ' kg';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Dismiss flash alerts when close button is clicked
 */
function setupFlashDismiss() {
    const closeBtns = document.querySelectorAll('.flash-close');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const message = btn.closest('.flash-message');
            if (message) {
                message.style.opacity = '0';
                setTimeout(() => {
                    message.remove();
                }, 300);
            }
        });
    });
}
