/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

let del = require('del');
let gulp = require('gulp');
let srcmap = require('gulp-sourcemaps');
let tslint = require('gulp-tslint');
let ts = require('gulp-typescript');
let cproc = require('child_process');
let os = require('os');

let config = require('./config');
let tsProject = ts.createProject('tsconfig.json');


// GULP TASKS //////////////////////////////////////////////////////////////
gulp.task('clean', function(done) {
    return del('out', done);
});

gulp.task('lint', () => {
    return gulp.src([
        config.paths.project.root + '/src/**/*.ts',
        config.paths.project.root + '/test/**/*.ts'
    ])
    .pipe((tslint({
        formatter: "verbose"
    })))
    .pipe(tslint.report());
});

gulp.task('compile:src', function(done) {
    gulp.src([
        config.paths.project.root + '/src/**/*.sql',
        config.paths.project.root + '/src/**/*.svg',
        config.paths.project.root + '/src/**/*.html'
    ]).pipe(gulp.dest('out/src/'));

    let srcFiles = [
        config.paths.project.root + '/src/**/*.ts',
        config.paths.project.root + '/src/**/*.js',
        config.paths.project.root + '/typings/**/*.ts'
    ];

    return gulp.src(srcFiles)
        .pipe(srcmap.init())
        .pipe(tsProject())
        .on('error', function() {
            if(process.env.BUILDMACHINE) {
                done('Failed to compile extension source, see above.');
                process.exit(1);
            }
        })
        // TODO: Reinstate localization code
        // .pipe(nls.rewriteLocalizeCalls())
        // .pipe(nls.createAdditionalLanguageFiles(nls.coreLanguages, config.paths.project.root + '/localization/i18n', undefined, false))
        .pipe(srcmap.write('.', { sourceRoot: function(file) { return file.cwd + '/src'; }}))
        .pipe(gulp.dest('out/src/'));
});

gulp.task('compile:test', function(done) {
    let srcFiles = [
        config.paths.project.root + '/test/**/*.ts',
        config.paths.project.root + '/typings/**/*.ts'
    ];

    return gulp.src(srcFiles)
        .pipe(srcmap.init())
        .pipe(tsProject())
        .on('error', function() {
            if(process.env.BUILDMACHINE) {
                done('Failed to compile test source, see above.');
                process.exit(1);
            }
        })
        .pipe(srcmap.write('.', {sourceRoot: function(file) { return file.cwd + '/test'; }}))
        .pipe(gulp.dest('out/test/'));
});

// COMPOSED GULP TASKS /////////////////////////////////////////////////////
gulp.task("compile", gulp.series("compile:src", "compile:test"));

gulp.task("build", gulp.series("clean", "lint", "compile"));

gulp.task("watch", function() {
    gulp.watch([config.paths.project.root + '/src/**/*',
                config.paths.project.root + '/test/**/*.ts'],
        gulp.series('build'))
});

gulp.task('test', (done) => {
    let workspace = process.env['WORKSPACE'];
    if (!workspace) {
        workspace = process.cwd();
    }
    process.env.JUNIT_REPORT_PATH = workspace + '/test-reports/ext_xunit.xml';

    let azuredatastudioPath = 'azuredatastudio';
    if (process.env['SQLOPS_DEV']) {
        let suffix = os.platform === 'win32' ? 'bat' : 'sh';
        azuredatastudioPath = `${process.env['SQLOPS_DEV']}/scripts/sql-cli.${suffix}`;
    }
    console.log(`Using SQLOPS Path of ${azuredatastudioPath}`);

    cproc.exec(`${azuredatastudioPath} --extensionDevelopmentPath="${workspace}" --extensionTestsPath="${workspace}/out/test" --verbose`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            process.exit(1);
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
        done();
    });
});
