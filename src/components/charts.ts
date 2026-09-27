import Chart from 'chart.js/auto';
import type { ChartConfiguration, ChartType, ChartData } from 'chart.js';

Chart.defaults.font.family = "'Inter', sans-serif";

/**
 * Chart.js's own defaults are set once and never theme-aware, so charts read
 * them fresh here on every creation instead — otherwise a chart built while
 * in light mode still uses colors tuned for a dark background (e.g. light-gray
 * axis/legend text on a white card is nearly unreadable).
 */
function getThemeChartColors() {
    const isLight = document.documentElement.classList.contains('light');
    return {
        text: isLight ? '#475569' : '#cbd5e1',
        grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        border: isLight ? 'rgba(15, 23, 42, 0.1)' : 'rgba(255, 255, 255, 0.1)',
        tooltipBg: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
        tooltipTitle: isLight ? '#0f172a' : '#fff',
        tooltipBody: isLight ? '#334155' : '#cbd5e1',
        ghostFill: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.1)',
        ghostBorder: isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.2)',
    };
}

export function createChart(
    canvasId: string,
    type: ChartType,
    data: ChartData,
    options: any = {}
): Chart | null {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return null;

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) {
        existingChart.destroy();
    }

    const colors = getThemeChartColors();
    Chart.defaults.color = colors.text;
    Chart.defaults.borderColor = colors.border;

    const config: ChartConfiguration = {
        type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: colors.text,
                    }
                },
                tooltip: {
                    backgroundColor: colors.tooltipBg,
                    titleColor: colors.tooltipTitle,
                    bodyColor: colors.tooltipBody,
                    borderColor: colors.border,
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true,
                    cornerRadius: 8,
                }
            },
            ...options
        }
    };

    return new Chart(canvas, config);
}

export function createDoughnutChart(canvasId: string, labels: string[], data: number[], colors: string[]) {
    return createChart(canvasId, 'doughnut', {
        labels,
        datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4
        }]
    }, {
        cutout: '70%',
    });
}

export function createLineChart(canvasId: string, labels: string[], datasets: any[]) {
    const colors = getThemeChartColors();
    return createChart(canvasId, 'line', {
        labels,
        datasets
    }, {
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    display: true,
                    color: colors.grid
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        elements: {
            line: {
                tension: 0.4 // Smooth curves
            },
            point: {
                radius: 4,
                hoverRadius: 6
            }
        }
    });
}

export function createBarChart(canvasId: string, labels: string[], datasets: any[]) {
    const colors = getThemeChartColors();
    return createChart(canvasId, 'bar', {
        labels,
        datasets
    }, {
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: colors.grid
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        borderRadius: 4,
        barPercentage: 0.6
    });
}

/** Colors for a "ghost" reference bar/area (e.g. a budget limit behind the actual-spend bar) that must stay visible on both themes. */
export function getGhostSeriesColors(): { backgroundColor: string; borderColor: string } {
    const colors = getThemeChartColors();
    return { backgroundColor: colors.ghostFill, borderColor: colors.ghostBorder };
}
