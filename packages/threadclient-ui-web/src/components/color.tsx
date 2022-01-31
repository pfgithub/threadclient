import type * as Generic from "api-types-generic";

const class_from_icon_color: {[key in Generic.Color]: string} = {
    'reddit-upvote': "text-$upvote-color",
    'reddit-downvote': "text-$downvote-color",
    'green': "text-green-600 dark:text-green-500",
    'white': "text-gray-300 dark:text-black",
    'yellow': "text-yellow-600 dark:text-yellow-300",
    'pink': "text-pink-500 dark:text-pink-300",
};

export function colorClass(color: null | Generic.Color): string {
    if(color == null) return "";
    return class_from_icon_color[color];
}