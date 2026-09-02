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

    // 5. Setup Theme Selector and OS theme preference sync
    setupThemeToggle();
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
 * Setup and render history line chart using Chart.js with Weekend Identification
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
        return;
    }

    // Sort chart data chronologically (oldest first) for correct graph flow
    chartData.sort((a, b) => new Date(a.date.replace(' ', 'T')) - new Date(b.date.replace(' ', 'T')));

    // Helper functions for dates, weekends, labels and tooltips
    function parseDate(dateStr) {
        const normalizedStr = dateStr.replace(' ', 'T');
        return new Date(normalizedStr);
    }

    function isWeekendDay(dateObj) {
        const day = dateObj.getDay();
        return day === 0 || day === 6; // 0 = Sunday (Dom), 6 = Saturday (Sáb)
    }

    function getDayName(dateObj) {
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        return days[dateObj.getDay()];
    }

    function getFullDayName(dateObj) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[dateObj.getDay()];
    }

    function formatLabel(dateStr, includeTime) {
        const dateObj = parseDate(dateStr);
        const dayAbbr = getDayName(dateObj);
        const month = dateObj.toLocaleDateString('es-ES', { month: 'short' });
        const dayNum = dateObj.getDate();
        const base = `${dayAbbr} ${dayNum} ${month}`;
        if (includeTime) {
            const time = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `${base} ${time}`;
        }
        return base;
    }

    function formatTooltip(dateStr, weight, prefix = '') {
        const dateObj = parseDate(dateStr);
        const fullDay = getFullDayName(dateObj);
        const isWknd = isWeekendDay(dateObj);
        const dateFormatted = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeFormatted = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
        const labelPrefix = prefix ? `${prefix}: ` : '';
        const weekendTag = isWknd ? ` • Fin de semana (${fullDay})` : ` • ${fullDay}`;
        return `${labelPrefix}${weight.toFixed(1)} kg (${dateFormatted}, ${timeFormatted})${weekendTag}`;
    }

    // Filter state: default to 20 days and all measurement times
    let currentRange = '20d';
    let currentFilter = 'all';

    // Calculate cutoff date for range (daysAgo at 00:00:00)
    function getCutoffDate(daysAgo) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 0, 0, 0, 0);
    }

    // Process and filter data with weekend metadata
    let currentFilteredData = [];
    function getFilteredData(filterType, rangeType) {
        // 1. Filter by range
        let rangeData = chartData;
        if (rangeType === '20d') {
            const cutoff = getCutoffDate(20);
            rangeData = chartData.filter(d => parseDate(d.date) >= cutoff);
        }

        // 2. Filter by mode (all, am, pm, average)
        if (filterType === 'all') {
            return rangeData.map(d => {
                const dateObj = parseDate(d.date);
                return {
                    weight: d.weight,
                    label: formatLabel(d.date, true),
                    tooltip: formatTooltip(d.date, d.weight),
                    isWeekend: isWeekendDay(dateObj),
                    fullDay: getFullDayName(dateObj),
                    dateStr: d.date
                };
            });
        } else if (filterType === 'am') {
            return rangeData
                .filter(d => {
                    const hour = parseDate(d.date).getHours();
                    return hour < 12;
                })
                .map(d => {
                    const dateObj = parseDate(d.date);
                    return {
                        weight: d.weight,
                        label: formatLabel(d.date, false),
                        tooltip: formatTooltip(d.date, d.weight, 'Despertar (AM)'),
                        isWeekend: isWeekendDay(dateObj),
                        fullDay: getFullDayName(dateObj),
                        dateStr: d.date
                    };
                });
        } else if (filterType === 'pm') {
            return rangeData
                .filter(d => {
                    const hour = parseDate(d.date).getHours();
                    return hour >= 12;
                })
                .map(d => {
                    const dateObj = parseDate(d.date);
                    return {
                        weight: d.weight,
                        label: formatLabel(d.date, false),
                        tooltip: formatTooltip(d.date, d.weight, 'Dormir (PM)'),
                        isWeekend: isWeekendDay(dateObj),
                        fullDay: getFullDayName(dateObj),
                        dateStr: d.date
                    };
                });
        } else if (filterType === 'average') {
            const groups = {};
            rangeData.forEach(d => {
                const dateKey = d.date.split(' ')[0]; // 'YYYY-MM-DD'
                if (!groups[dateKey]) {
                    groups[dateKey] = [];
                }
                groups[dateKey].push(d.weight);
            });
            const sortedDates = Object.keys(groups).sort();
            return sortedDates.map(dateKey => {
                const weights = groups[dateKey];
                const avg = weights.reduce((sum, w) => sum + w, 0) / weights.length;
                const dateStr = `${dateKey} 12:00:00`;
                const dateObj = parseDate(dateStr);
                const isWknd = isWeekendDay(dateObj);
                const fullDay = getFullDayName(dateObj);
                const dateFormatted = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                const weekendTag = isWknd ? ` • Fin de semana (${fullDay})` : ` • ${fullDay}`;
                return {
                    weight: avg,
                    label: formatLabel(dateStr, false),
                    tooltip: `Promedio: ${avg.toFixed(1)} kg (${weights.length} reg. - ${dateFormatted})${weekendTag}`,
                    isWeekend: isWknd,
                    fullDay: fullDay,
                    dateStr: dateStr
                };
            });
        }
        return [];
    }

    // Fallback: If user has records but none in the last 20 days,
    // activate 'all' so they don't see an empty chart on first load
    const hasLogsInLast20Days = chartData.some(d => parseDate(d.date) >= getCutoffDate(20));
    if (!hasLogsInLast20Days && chartData.length > 0) {
        currentRange = 'all';
        const range20Btn = document.getElementById('range-20d');
        const rangeAllBtn = document.getElementById('range-all');
        if (range20Btn && rangeAllBtn) {
            range20Btn.classList.remove('active');
            rangeAllBtn.classList.add('active');
        }
    }

    // Default filtered data
    currentFilteredData = getFilteredData(currentFilter, currentRange);

    // Helper to update count badge
    function updateCountBadge() {
        const countBadge = document.getElementById('chart-count-badge');
        if (countBadge) {
            const count = currentFilteredData.length;
            countBadge.textContent = `${count} ${count === 1 ? 'registro' : 'registros'}`;
        }
    }
    updateCountBadge();

    // Helper to apply dataset styling (weekend amber vs weekday purple)
    function applyDatasetStyles(dataset, dataList) {
        dataset.data = dataList.map(d => d.weight);
        dataset.pointBackgroundColor = dataList.map(d => d.isWeekend ? '#f59e0b' : '#a855f7');
        dataset.pointBorderColor = dataList.map(d => '#ffffff');
        const isDense = dataList.length > 35;
        dataset.pointBorderWidth = dataList.map(d => d.isWeekend ? (isDense ? 2 : 2.5) : (isDense ? 1.5 : 2));
        dataset.pointRadius = dataList.map(d => d.isWeekend ? (isDense ? 4.5 : 6) : (isDense ? 3 : 4));
        dataset.pointHoverRadius = dataList.map(d => d.isWeekend ? (isDense ? 7 : 8.5) : (isDense ? 5 : 6));
        dataset.pointHoverBackgroundColor = dataList.map(d => d.isWeekend ? '#d97706' : '#9333ea');
    }

    // Gradient fill beneath line
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
    gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    // Theme adaptive colors
    let currentTheme = document.documentElement.getAttribute('data-theme');
    if (!currentTheme) {
        currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const isLight = currentTheme === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const ticksColor = isLight ? '#64748b' : '#9ca3af';

    // Chart.js Plugin to draw vertical background highlight bands on weekends
    const weekendBackgroundPlugin = {
        id: 'weekendBackground',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea, scales } = chart;
            if (!chartArea || !scales || !scales.x) return;
            const { top, height, left: chartLeft, right: chartRight } = chartArea;
            const x = scales.x;
            
            if (!currentFilteredData || currentFilteredData.length === 0) return;

            let theme = document.documentElement.getAttribute('data-theme');
            if (!theme) {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            const isLightMode = theme === 'light';
            const bandColor = isLightMode ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.12)';
            const bandTopColor = isLightMode ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.45)';

            ctx.save();

            currentFilteredData.forEach((item, index) => {
                if (item.isWeekend) {
                    const xPos = x.getPixelForValue(index);
                    let halfWidth = 16;
                    if (currentFilteredData.length > 1) {
                        if (index === 0) {
                            const nextX = x.getPixelForValue(1);
                            halfWidth = Math.min(Math.abs(nextX - xPos) / 2, 28);
                        } else if (index === currentFilteredData.length - 1) {
                            const prevX = x.getPixelForValue(index - 1);
                            halfWidth = Math.min(Math.abs(xPos - prevX) / 2, 28);
                        } else {
                            const prevX = x.getPixelForValue(index - 1);
                            const nextX = x.getPixelForValue(index + 1);
                            const distPrev = Math.abs(xPos - prevX);
                            const distNext = Math.abs(nextX - xPos);
                            halfWidth = Math.min((distPrev + distNext) / 4, 28);
                        }
                    }

                    let left = Math.max(xPos - halfWidth, chartLeft);
                    let width = halfWidth * 2;
                    if (left + width > chartRight) {
                        width = chartRight - left;
                    }

                    // Draw background vertical highlight band
                    ctx.fillStyle = bandColor;
                    ctx.fillRect(left, top, width, height);

                    // Draw subtle top border accent
                    ctx.fillStyle = bandTopColor;
                    ctx.fillRect(left, top, width, 3);
                }
            });

            ctx.restore();
        }
    };

    const initialDataset = {
        label: 'Peso (kg)',
        borderColor: '#6366f1',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        backgroundColor: gradient
    };
    applyDatasetStyles(initialDataset, currentFilteredData);

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: currentFilteredData.map(d => d.label),
            datasets: [initialDataset]
        },
        plugins: [weekendBackgroundPlugin],
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
                        title: function() {
                            return '';
                        },
                        label: function(context) {
                            const idx = context.dataIndex;
                            return currentFilteredData[idx] ? ` ${currentFilteredData[idx].tooltip}` : '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 14,
                        color: function(context) {
                            const item = currentFilteredData[context.index];
                            return (item && item.isWeekend) ? '#f59e0b' : ticksColor;
                        },
                        font: function(context) {
                            const item = currentFilteredData[context.index];
                            return {
                                family: 'Outfit',
                                weight: (item && item.isWeekend) ? '600' : '400'
                            };
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: ticksColor,
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

    // Save chart instance globally to update theme dynamically
    window.weightChartInstance = chart;

    // Helper to refresh chart data, labels, styles, count badge and empty state
    function updateChartUI() {
        currentFilteredData = getFilteredData(currentFilter, currentRange);

        // Update count badge
        updateCountBadge();

        // Manage contextual empty state overlay
        const emptyOverlay = document.getElementById('chart-empty-filter');
        const emptyMsg = document.getElementById('chart-empty-message');
        if (emptyOverlay) {
            if (currentFilteredData.length === 0) {
                emptyOverlay.style.display = 'flex';
                if (emptyMsg) {
                    if (currentRange === '20d') {
                        emptyMsg.textContent = 'No hay registros en los últimos 20 días con este filtro.';
                    } else {
                        emptyMsg.textContent = 'No hay registros con este filtro.';
                    }
                }
            } else {
                emptyOverlay.style.display = 'none';
            }
        }

        // Update chart labels, dataset and re-render
        chart.data.labels = currentFilteredData.map(d => d.label);
        applyDatasetStyles(chart.data.datasets[0], currentFilteredData);
        chart.update();
    }

    // Wire up range button clicks (20 days vs All)
    const rangeBtns = document.querySelectorAll('.chart-range-btn');
    rangeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            rangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = btn.getAttribute('data-range');
            updateChartUI();
        });
    });

    // Wire up mode button clicks (All, AM, PM, Average)
    const typeBtns = document.querySelectorAll('.chart-type-btn');
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            updateChartUI();
        });
    });

    // Wire up reset range button from contextual empty overlay
    const resetRangeBtn = document.getElementById('btn-chart-reset-range');
    if (resetRangeBtn) {
        resetRangeBtn.addEventListener('click', () => {
            const rangeAllBtn = document.getElementById('range-all');
            if (rangeAllBtn) {
                rangeAllBtn.click();
            }
        });
    }
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

/**
 * Setup theme toggle actions and system preference listeners
 */
function setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', () => {
        let currentTheme = document.documentElement.getAttribute('data-theme');
        if (!currentTheme) {
            // Check system preference
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            currentTheme = systemPrefersDark ? 'dark' : 'light';
        }
        
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Update chart colors dynamically if it is loaded
        updateChartColors(newTheme);
    });
    
    // Listen for system color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        // Only adapt if the user hasn't explicitly set a theme preference
        if (!localStorage.getItem('theme')) {
            const systemTheme = e.matches ? 'dark' : 'light';
            updateChartColors(systemTheme);
        }
    });
}

/**
 * Dynamically updates chart grid and ticks colors when theme changes
 */
function updateChartColors(theme) {
    if (!window.weightChartInstance) return;
    
    const isLight = theme === 'light';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    const ticksColor = isLight ? '#64748b' : '#9ca3af';
    
    window.weightChartInstance.options.scales.x.grid.color = gridColor;
    window.weightChartInstance.options.scales.y.grid.color = gridColor;
    window.weightChartInstance.options.scales.x.ticks.color = function(context) {
        if (!window.weightChartInstance.data.datasets[0] || !window.weightChartInstance.data.datasets[0].pointBackgroundColor) {
            return ticksColor;
        }
        // If the point is colored amber, it is a weekend
        const colors = window.weightChartInstance.data.datasets[0].pointBackgroundColor;
        return (colors[context.index] === '#f59e0b') ? '#f59e0b' : ticksColor;
    };
    window.weightChartInstance.options.scales.y.ticks.color = ticksColor;
    window.weightChartInstance.update();
}

