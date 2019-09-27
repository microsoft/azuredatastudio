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
const del = require('del');
const serviceDownloader = require('service-downloader').ServiceDownloadProvider;
const platformInfo = require('service-downloader/out/platform').PlatformInformation;
const path = require('path');
const fs = require('fs');
const rollup = require('rollup');
const rollupNodeResolve = require('rollup-plugin-node-resolve');
const rollupCommonJS = require('rollup-plugin-commonjs');

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

function installService() {
	let config = require('../extensions/mssql/config.json');
	return platformInfo.getCurrent().then(p => {
		let runtime = p.runtimeId;
		// fix path since it won't be correct
		config.installDirectory = path.join(__dirname, '../extensions/mssql/src', config.installDirectory);
		var installer = new serviceDownloader(config);
		let serviceInstallFolder = installer.getInstallDirectory(runtime);
		console.log('Cleaning up the install folder: ' + serviceInstallFolder);
		return del(serviceInstallFolder + '/*').then(() => {
			console.log('Installing the service. Install folder: ' + serviceInstallFolder);
			return installer.installService(runtime);
		}, delError => {
			console.log('failed to delete the install folder error: ' + delError);
		});
	});
}

gulp.task('install-sqltoolsservice', () => {
	return installService();
});

function installSsmsMin() {
	const config = require('../extensions/admin-tool-ext-win/config.json');
	return platformInfo.getCurrent().then(p => {
		const runtime = p.runtimeId;
		// fix path since it won't be correct
		config.installDirectory = path.join(__dirname, '..', 'extensions', 'admin-tool-ext-win', config.installDirectory);
		var installer = new serviceDownloader(config);
		const serviceInstallFolder = installer.getInstallDirectory(runtime);
		const serviceCleanupFolder = path.join(serviceInstallFolder, '..');
		console.log('Cleaning up the install folder: ' + serviceCleanupFolder);
		return del(serviceCleanupFolder + '/*').then(() => {
			console.log('Installing the service. Install folder: ' + serviceInstallFolder);
			return installer.installService(runtime);
		}, delError => {
			console.log('failed to delete the install folder error: ' + delError);
		});
	});
}

gulp.task('install-ssmsmin', () => {
	return installSsmsMin();
});

async function rollupModule(options) {
	const moduleName = options.moduleName;
	try {
		const inputFile = options.inputFile;
		const outputDirectory = options.outputDirectory;

		await fs.promises.mkdir(outputDirectory, {
			recursive: true
		});

		const outputFileName = options.outputFileName;
		const outputMapName = `${outputFileName}.map`;
		const external = options.external || [];

		const outputFilePath = path.resolve(outputDirectory, outputFileName);
		const outputMapPath = path.resolve(outputDirectory, outputMapName);

		const bundle = await rollup.rollup({
			input: inputFile,
			plugins: [
				rollupNodeResolve(),
				rollupCommonJS(),
			],
			external,
		});

		const generatedBundle = await bundle.generate({
			output: {
				name: moduleName
			},
			format: 'umd',
			sourcemap: true
		});

		const result = generatedBundle.output[0];
		result.code = result.code + '\n//# sourceMappingURL=' + path.basename(outputMapName);

		await fs.promises.writeFile(outputFilePath, result.code);
		await fs.promises.writeFile(outputMapPath, result.map);

		return {
			name: moduleName,
			result: true
		};
	} catch (ex) {
		return {
			name: moduleName,
			result: false,
			exception: ex
		};
	}
}

module.exports = {
	rollupModule
};
