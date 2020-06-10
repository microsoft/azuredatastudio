/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

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
gulp.task('clean', function (done) {
	return del('out', done);
});

gulp.task('lint', () => {
	return gulp.src([
		config.paths.project.root + '/src/**/*.ts'
	])
		.pipe((tslint({
			formatter: 'verbose'
		})))
		.pipe(tslint.report());
});

gulp.task('compile:src', function (done) {
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
		.on('error', function () {
			if (process.env.BUILDMACHINE) {
				done('Failed to compile extension source, see above.');
				process.exit(1);
			}
		})
		.pipe(srcmap.write('.', {
			sourceRoot: function (file) {
				return file.cwd + '/src';
			}
		}))
		.pipe(gulp.dest('out/src/'));
});

// COMPOSED GULP TASKS /////////////////////////////////////////////////////
gulp.task('compile', gulp.series('compile:src'));

gulp.task('build', gulp.series('clean', 'lint', 'compile'));

gulp.task('watch', function () {
	gulp.watch([config.paths.project.root + '/src/**/*'],
		gulp.series('build'));
});
