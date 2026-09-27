/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Use class-based dark mode
    theme: {
        extend: {
            fontFamily: {
                sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                // Brand palette
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#93c5fd', // Accent
                    400: '#38bdf8', // Light Blue
                    500: '#0ea5e9', // Primary Blue
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#0b1020', // Primary Dark
                },
                brand: {
                    dark: '#0b1020',
                    blue: '#0ea5e9',
                    lightBlue: '#38bdf8',
                    accent: '#93c5fd',
                },
                income: '#22c55e', // Success
                expense: '#ef4444', // Alert
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
