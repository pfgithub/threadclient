import { defineConfig } from "windicss/helpers";
import colors from "windicss/colors";
import plugin from "windicss/plugin";

export default defineConfig({
    extract: {
        include: [
            "./src/**/*",
            "./index.html",
        ],
    },
    darkMode: "class",
    shortcuts: {
        'max-w-inherit': {
            'max-width': "inherit",
        },
        'max-h-inherit': {
            'max-height': "inherit",
        },
    },
    theme: {
        colors: {
            // TODO move these css variables into the tailwind config and get rid
            // of the css variables
            'transparent': "transparent",
            'current': "currentColor",
            'gray': {
                50: "var(--cool-gray-50)",
                100: "var(--cool-gray-100)",
                200: "var(--cool-gray-200)",
                300: "var(--cool-gray-300)",
                400: "var(--cool-gray-400)",
                500: "var(--cool-gray-500)",
                600: "var(--cool-gray-600)",
                700: "var(--cool-gray-700)",
                800: "var(--cool-gray-800)",
                900: "var(--cool-gray-900)",
            },
            'slate': colors.slate,

            // shifts 700 and 800 up by a half-step. the gap from 800 to 900 felt too large. also this is only
            // used on dark mode so it might be different than the light mode uses of these colors
            'zinc': {...colors.zinc as Record<number, string>, 700: "#333338", 800: "#202023"}, 
            'rgray': colors.coolGray,
            'blue': colors.blue,
            'green': colors.emerald,
            'red': colors.red,
            'cyan': colors.cyan,
            'light-blue': colors.lightBlue,
            'orange': colors.orange,
            'yellow': colors.yellow,
            'purple': colors.purple,
            'pink': colors.pink,
            'flair-light': "var(--flair-color)",
            'flair-dark': "var(--flair-color-dark)",
            'body': "var(--body-color)",
            // 'border': "var(--border-color)",
            'textc': "var(--text-color)",
            'spoiler-color': "var(--spoiler-color)",
            'spoiler-color-hover': "var(--spoiler-color-hover)",
            'spoiler-color-revealed': "var(--spoiler-color-revealed)",
            'white': "var(--white)",
            'black': "var(--black)",
            'rwhite': "#FFF",
            'rblack': "#000",
            'light': {
                50: "#FFF",
                100: "#d6dde4",
                200: "#eee",
                300: "#ddd",
                400: "#aaa",
                500: "#666",
                600: "#4f4f4f",
                700: "#444",
            },
            'dark': {
                900: "black",
                800: "#131516",
                700: "rgb(34, 36, 38)",
                600: "rgb(43, 47, 49)",
                500: "rgb(72, 78, 81)",
                400: "rgb(168, 160, 149)",
                300: "rgb(189, 183, 175)"
            },
            // nightwind doesn't work properly with dahes in names for some reason
            'postcolor': {100: "var(--postcolor-100)", 800: "#181a1b"}, // TODO add more colors here :: spoiler-color spoiler-color-hover spoiler-color-revealed + those collapse btn colors
        },
        cursor: {
            'auto': 'auto',
            'default': 'default',
            'pointer': 'pointer',
            'wait': 'wait',
            'text': 'text',
            'move': 'move',
            'not-allowed': 'not-allowed',
            'crosshair': 'crosshair',
            'none': 'none',
        },
    },
    plugins: [
        require('@windicss/plugin-icons'),
        plugin(({ addDynamic, addUtilities, variants }) => {
            addUtilities({
                '.max-lines': {
                    'overflow': "hidden",
                    'text-overflow': "ellipsis",
                    'display': "-webkit-box",
                    '-webkit-box-orient': "vertical",
                },
            });
            addDynamic('max-lines', ({ Utility, Style }) => {
                return Utility.handler
                    .handleNumber(1, undefined, 'int')
                    .createProperty("-webkit-line-clamp", v => v)
                ;
            }, variants('skew'))
        }),
    ],
});