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
const serviceDownloader = require('service-downloader').ServiceDownloadProvider;
const platform = require('service-downloader/out/platform').PlatformInformation;
const path = require('path');
const ext = require('./lib/extensions');
const task = require('./lib/task');
const glob = require('glob');
const vsce = require('vsce');
const mkdirp = require('mkdirp');
const fs = require('fs').promises;
const assert = require('assert');

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

async function installService(configPath, runtimId) {
	const absoluteConfigPath = require.resolve(configPath);
	const config = require(absoluteConfigPath);
	const runtime = runtimId || (await platform.getCurrent()).runtimeId;
	// fix path since it won't be correct
	config.installDirectory = path.join(path.dirname(absoluteConfigPath), config.installDirectory);
	console.log('install diectory', config.installDirectory);
	let installer = new serviceDownloader(config);
	installer.eventEmitter.onAny((event, ...values) => {
		console.log(`ServiceDownloader Event : ${event}${values && values.length > 0 ? ` - ${values.join(' ')}` : ''}`);
	});
	let serviceInstallFolder = installer.getInstallDirectory(runtime);
	console.log('Cleaning up the install folder: ' + serviceInstallFolder);
	try {
		await util.rimraf(serviceInstallFolder)();
	} catch (e) {
		console.error('failed to delete the install folder error: ' + e);
		throw e;
	}
	await installer.installService(runtime);
	let stat;
	for (const file of config.executableFiles) {
		try {
			stat = await fs.stat(path.join(serviceInstallFolder, file));
		} catch (e) { }
	}

	assert(stat);
}

gulp.task('install-sqltoolsservice', () => installService('../extensions/mssql/config.json'));

gulp.task('install-ssmsmin', () => installService('../extensions/admin-tool-ext-win/config.json', 'Windows_64')); // admin-tool-ext is a windows only extension, and we only ship a 64 bit version, so locking the binaries as such

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
