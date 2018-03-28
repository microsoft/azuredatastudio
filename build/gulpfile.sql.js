/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const util = require('./lib/util');
const tsfmt = require('typescript-formatter');
const es = require('event-stream');
const filter = require('gulp-filter');

gulp.task('clean-mssql-extension', util.rimraf('extensions/mssql/node_modules'));
gulp.task('clean-credentials-extension', util.rimraf('extensions/credentials/node_modules'));

gulp.task('fmt', () => formatStagedFiles());
const formatFiles = (some) => {
	const formatting = es.map(function (file, cb) {

			tsfmt.processString(file.path, file.contents.toString('utf8'), {
				replace: true,
				tsfmt: true,
				tslint: true,
				tsconfig: true
				// verbose: true
			}).then(result => {
				console.info('ran formatting on file ' + file.path + ' result: ' + result.message);
				if (result.error) {
					console.error(result.message);
					errorCount++;
				}
				cb(null, file);

			}, err => {
				cb(err);
			});
		});
	return gulp.src(some, { base: '.' })
			.pipe(filter(f => !f.stat.isDirectory()))
			.pipe(formatting);

}

const formatStagedFiles = () => {
	const cp = require('child_process');
	cp.exec('git diff --name-only', { maxBuffer: 2000 * 1024 }, (err, out) => {
			if (err) {
				console.error();
				console.error(err);
				process.exit(1);
			}

			const some = out
				.split(/\r?\n/)
				.filter(l => !!l)
				.filter(l => l.match(/.*.ts$/i));

			formatFiles(some).on('error', err => {
				console.error();
				console.error(err);
				process.exit(1);
			});
		});

	cp.exec('git diff --cached --name-only', { maxBuffer: 2000 * 1024 }, (err, out) => {
			if (err) {
				console.error();
				console.error(err);
				process.exit(1);
			}

			const some = out
				.split(/\r?\n/)
				.filter(l => !!l)
				.filter(l => l.match(/.*.ts$/i));

			formatFiles(some).on('error', err => {
				console.error();
				console.error(err);
				process.exit(1);
			});
		});
}