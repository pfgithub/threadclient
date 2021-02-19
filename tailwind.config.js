const colors = require("tailwindcss/colors");

module.exports = {
    purge: process.env.NODE_ENV === "development" ? [] : {
        enabled: true,
        content: [
            "./src/**/*",
            "./static/**/*.html",
        ],
    },
    darkMode: "class",
    theme: {
        colors: {
            'transparent': "transparent",
            'current': "currentColor",
            'gray': colors.coolGray,
            'blue': colors.blue,
            'green': colors.emerald,
            'red': colors.red,
            'cyan': colors.cyan,
            'light-blue': colors.lightBlue,
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
    plugins: [
        require("nightwind"),
    ],
};