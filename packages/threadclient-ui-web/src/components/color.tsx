import type * as Generic from "api-types-generic";

const class_from_icon_color: {[key in Generic.Color]: string} = {
    'orange': "text-orange-600 dark:text-orange-400",
    'indigo': "text-indigo-500 dark:text-indigo-400",
    'blue': "text-blue-600 dark:text-blue-500",
    'green': "text-green-600 dark:text-green-500",
    'white': "text-gray-300 dark:text-black",
    'yellow': "text-yellow-600 dark:text-yellow-300",
    'pink': "text-pink-500 dark:text-pink-300",
};

export function colorClass(color: null | Generic.Color): string {
    if(color == null) return "";
    return class_from_icon_color[color];
}

const bg_class_from_color: {[key in Generic.Color]?: [light: string, dark: string]} = {
    'blue': ["bg-blue-700", "bg-blue-500"],
    'green': ["bg-green-700", "bg-green-500"],
};

export function colorBackground(color: null | Generic.Color, light: boolean): string {
    if(color == null) return "";
    return bg_class_from_color[color]?.[+light] ?? "bg-red-500";
}