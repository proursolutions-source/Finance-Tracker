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
                // Brand palette — aligned to the Money Flow brand spec
                // (#00C2FF primary / #0099FF secondary / #0F1B2D navy), with
                // the surrounding shades of the ramp adjusted to stay smooth.
                primary: {
                    50: '#f0faff',
                    100: '#e0f6ff',
                    200: '#b9edff',
                    300: '#7ddcff',
                    400: '#00c2ff', // Primary Blue (brand)
                    500: '#0099ff', // Secondary Blue (brand)
                    600: '#0077cc',
                    700: '#005a9e',
                    800: '#064571',
                    900: '#0c3252',
                    950: '#0f1b2d', // Dark Navy (brand)
                },
                brand: {
                    dark: '#0f1b2d',
                    blue: '#0099ff',
                    lightBlue: '#00c2ff',
                    accent: '#7ddcff',
                },
                income: '#10d39f', // Success (brand)
                expense: '#ff4d4f', // Error (brand)
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
