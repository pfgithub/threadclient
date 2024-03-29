import { defineConfig } from "windicss/helpers";
import colors from "windicss/colors";
import plugin from "windicss/plugin";
import * as heropatterns from "./heropatterns";

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
            'indigo': colors.indigo,
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
            'auto': "auto",
            'default': "default",
            'pointer': "pointer",
            'wait': "wait",
            'text': "text",
            'move': "move",
            'not-allowed': "not-allowed",
            'crosshair': "crosshair",
            'none': "none",
        },

        extend: {
            borderWidth: {1: "1px"},
            backgroundImage: {
                'graph-zinc-800': `url("${heropatterns.graph("27272A")}")`,
                'graph-slate-350': `url("${heropatterns.graph("B0BCCD")}")`,
                'topography-zinc-800': `url("${heropatterns.topography("27272A")}")`,
                'topography-slate-350': `url("${heropatterns.topography("B0BCCD")}")`,
            },
            animation: {
                'loading': "loading 1s ease-in-out normal forwards",
            },
            keyframes: {
                'loading': {
                    '50%': {
                        'opacity': "1.0",
                    },
                    '100%': {
                        'opacity': "0.5",
                    }
                },
            },
        },
    },
    // considering switching to unocss w/ tailwind preset just because writing rules like this is not very fun
    // also need to use @unocss/reset/tailwind.css
    plugins: [
        require("@windicss/plugin-icons"),
        plugin(({ addDynamic, addUtilities, variants, addVariant }) => {
            addUtilities({
                '.max-lines': {
                    'overflow': "hidden",
                    'text-overflow': "ellipsis",
                    'display': "-webkit-box",
                    '-webkit-box-orient': "vertical",
                },
            });
            addDynamic("max-lines", ({ Utility: utility, Style: style }) => {
                return utility.handler
                    .handleNumber(1, undefined, "int")
                    .createProperty("-webkit-line-clamp", v => v)
                ;
            }, variants("skew"));
        }),
        plugin(({addVariant, e}) => {
            // these are cool, i didn't know css has them
            // makes it easy to eg make buttons bigger on touchscreen & mobile but not
            // when you're using a mouse on a touchscreen device i assume
            addVariant("can-hover", ({atRule}) => {
                // would be nice if we could make all hover: states `can-hover:hover:`
                // because it's annoying when you're scrolling on mobile and random stuff
                // keeps highlighting
                return atRule("@media (hover: hover)");
            });
            addVariant("no-hover", ({atRule}) => {
                return atRule("@media (hover: none)");
            });
            addVariant("pointer-coarse", ({atRule}) => {
                return atRule("@media (pointer: coarse)");
            });
            addVariant("pointer-fine", ({atRule}) => {
                return atRule("@media (pointer: fine)");
            });
            addVariant("pointer-none", ({atRule}) => {
                return atRule("@media (pointer: none)");
            });
            addVariant("hocus", ({ modifySelectors }) => {
                // wow I don't like this name but it's useful
                return modifySelectors(({ className: class_name }) => {
                    return `.${class_name}:hover, .${class_name}:focus`;
                });
            });
            addVariant("hactive", ({atRule, modifySelectors}) => {
                // vv not sure if you can do this. this is why i want to switch to unocss
                // @media (hover: hover) {
                //   &:hover { … }
                // }
                // &:active {…}
                return modifySelectors(({className: class_name}) => {
                    return `html.atmedia-hover-hover .${class_name}:hover, .${class_name}:active`;
                });
            });
        }),
        plugin(({addVariant, addUtilities, e}) => {
            // tailwind css has this
            addVariant("placeholder", ({ modifySelectors }) => {
                return modifySelectors(({ className: class_name }) => {
                    return `.${class_name}::placeholder`;
                });
            });
            addUtilities({
                '.spin': {
                    'animation': "spin 1s linear infinite",
                },

                '@keyframes spin': {
                    'from': {
                        'transform': "rotate(0deg)",
                    },
                    'to': {
                        transform: "rotate(360deg)",
                    },
                },
            });
        }),
    ],
});