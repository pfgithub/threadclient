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
            // TODO move these css variables into the tailwind config and get rid
            // of the css variables
            'transparent': "transparent",
            'current': "currentColor",
            'gray': colors.coolGray,
            'blue': colors.blue,
            'green': colors.emerald,
            'red': colors.red,
            'cyan': colors.cyan,
            'light-blue': colors.lightBlue,
            'orange': colors.orange,
            'flair-light': "var(--flair-color)",
            'flair-dark': "var(--flair-color-dark)",
            'body': "var(--body-color)",
            'border': "var(--border-color)",
            'textc': "var(--text-color)",
            'userlink-color-light': "var(--light-color)",
            'userlink-color-dark': "var(--dark-color)",
            'spoiler-color': "var(--spoiler-color)",
            'spoiler-color-hover': "var(--spoiler-color-hover)",
            'spoiler-color-revealed': "var(--spoiler-color-revealed)",
            'white': "#FFF",
            'black': "#000",
            // nightwind doesn't work properly with dahes in names for some reason
            'postcolor': {100: "#FFF", 800: "#181a1b"}, // TODO add more colors here :: spoiler-color spoiler-color-hover spoiler-color-revealed + those collapse btn colors
        },
    },
    plugins: [
        require("nightwind"),
    ],
};