const colors = require("tailwindcss/colors");

module.exports = {
    purge: [
        // "./src/**/*.js",
        // "./src/**/*.jsx",
        // "./src/**/*.ts",
        // "./src/**/*.tsx",
        // "./static/**/*.html",
    ],
    darkMode: "media",
    theme: {
        theme: {
            colors: {
                'transparent': "transparent",
                'current': "currentColor",
                'gray': colors.coolGray,
                'flair-light': "var(--flair-color)",
                'flair-dark': "var(--flair-color-dark)",
                'body': "var(--body-color)",
                'border': "var(--border-color)",
                'textc': "var(--text-color)",
            },
        },
    },
    variants: {},
    plugins: [],
};