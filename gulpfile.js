const gulp = require("gulp");
const sourcemaps = require("gulp-sourcemaps");
const babel = require("gulp-babel");
const concat = require("gulp-concat");
const fs = require("fs");

const typescript = function() {
    return gulp
        .src("src/**/*.ts")
        .pipe(sourcemaps.init())
        .pipe(babel({
            "presets": [
                "@babel/preset-typescript",
                ["@babel/preset-env", {
                    "targets": {"browsers": ">10%"},
                    "modules": false,
                }],
            ],
            "plugins": [
                ["@babel/plugin-proposal-pipeline-operator", {
                    "proposal": "smart",
                }],
            ],
        }))
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest("dist"));
}
const nocomp = function() {
    return gulp.src("static/**/*").pipe(gulp.dest("dist"));
}

const all = gulp.series(typescript, nocomp);
gulp.task("all", all);

gulp.task("watch", gulp.series("all", () => {
    gulp.watch("src/**/*.ts", typescript);
    gulp.watch("static/**/*", nocomp);
}));
