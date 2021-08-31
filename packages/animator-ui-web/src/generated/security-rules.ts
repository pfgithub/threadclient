/* eslint-disable */
export interface Model {
    users: { [key: string]: User };
    projects: { [key: string]: Project };
    actions: { [key: string]: Actions };
}

export interface User {
    created: number;
    projects: { [key: string]: ProjectListEntry };
}

export interface ProjectListEntry {
    updated: number;
}

export type Actions = { [key: string]: Action };



export interface Project {
    created: number;
    owner: string;
    config: Config;
}

export interface Config {
    title: string;
    audio: string;
    framerate: number;
    width: number;
    height: number;
}

export interface Action {
    created: number;
    author: string;
    value: Object;
}