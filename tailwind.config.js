const colors = require("tailwindcss/colors");

module.exports = {
    purge: process.env.NODE_ENV === "development" ? [] : [
        "./src/**/*",
        "./static/**/*.html",
    ],
    darkMode: "media",
    theme: {
        colors: {
            'transparent': "transparent",
            'current': "currentColor",
            'gray': colors.coolGray,
            'blue': colors.blue,
            'green': colors.emerald,
            'red': colors.red,
            'flair-light': "var(--flair-color)",
            'flair-dark': "var(--flair-color-dark)",
            'body': "var(--body-color)",
            'border': "var(--border-color)",
            'textc': "var(--text-color)",
            'userlink-color-light': "var(--light-color)",
            'userlink-color-dark': "var(--dark-color)",
            'white': "#FFF",
            'black': "#000",
        },
    },
    variants: {},
    plugins: [],
};