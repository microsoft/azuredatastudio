/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
const gulp = require('gulp');
const tsfmt = require('typescript-formatter');
const es = require('event-stream');
const filter = require('gulp-filter');
const path = require('path');
const ext = require('./lib/extensions');
const task = require('./lib/task');
const glob = require('glob');
const vsce = require('vsce');
const mkdirp = require('mkdirp');

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
			}
			cb(null, file);

		}, err => {
			cb(err);
		});
	});
	return gulp.src(some, {
			base: '.'
		})
		.pipe(filter(f => !f.stat.isDirectory()))
		.pipe(formatting);

};

const formatStagedFiles = () => {
	const cp = require('child_process');
	cp.exec('git diff --name-only', {
		maxBuffer: 2000 * 1024
	}, (err, out) => {
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

	cp.exec('git diff --cached --name-only', {
		maxBuffer: 2000 * 1024
	}, (err, out) => {
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
};

const root = path.dirname(__dirname);

gulp.task('package-external-extensions', task.series(
	task.define('bundle-external-extensions-build', () => ext.packageExternalExtensionsStream().pipe(gulp.dest('.build/external'))),
	task.define('create-external-extension-vsix-build', () => {
		const vsixes = glob.sync('.build/external/extensions/*/package.json').map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		}).map(element => {
			const pkgJson = require(path.join(element.path, 'package.json'));
			const vsixDirectory = path.join(root, '.build', 'extensions');
			mkdirp.sync(vsixDirectory);
			const packagePath = path.join(vsixDirectory, `${pkgJson.name}-${pkgJson.version}.vsix`);
			console.info('Creating vsix for ' + element.path + ' result:' + packagePath);
			return vsce.createVSIX({
				cwd: element.path,
				packagePath: packagePath,
				useYarn: true
			});
		});

		return Promise.all(vsixes);
	})
));

gulp.task('package-rebuild-extensions', task.series(
	task.define('clean-rebuild-extensions', () => ext.cleanRebuildExtensions('.build/extensions')),
	task.define('rebuild-extensions-build', () => ext.packageRebuildExtensionsStream().pipe(gulp.dest('.build'))),
));
