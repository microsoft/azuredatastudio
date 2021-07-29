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
const loc = require('./lib/locFunc');
const task = require('./lib/task');
const glob = require('glob');
const vsce = require('vsce');
const mkdirp = require('mkdirp');
const rename = require('gulp-rename');
const fs = require('fs');

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
	task.define('create-external-extension-vsix-build', async () => {
		const vsixes = glob.sync('.build/external/extensions/*/package.json').map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})
		.filter(element => ext.vscodeExternalExtensions.indexOf(element.name) === -1) // VS Code external extensions are bundled into ADS so no need to create a normal VSIX for them
		.map(element => {
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
		// Wait for all the initial VSIXes to be completed before making the VS Code ones since we'll be overwriting
		// values in the package.json for those.
		await Promise.all(vsixes);

		// Go through and find the extensions which build separate versions of themselves for VS Code.
		// This is currently a pretty simplistic process, essentially just replacing certain values in
		// the package.json. It doesn't handle more complex tasks such as replacing localized strings.
		const vscodeVsixes = glob.sync('.build/external/extensions/*/package.vscode.json')
			.map(async vscodeManifestRelativePath => {
				const vscodeManifestFullPath = path.join(root, vscodeManifestRelativePath);
				const packageDir = path.dirname(vscodeManifestFullPath);
				const packageManifestPath = path.join(packageDir, 'package.json');
				const json = require('gulp-json-editor');
				const packageJsonStream = gulp.src(packageManifestPath) // Create stream for the original package.json
					.pipe(json(data => { // And now use gulp-json-editor to modify the contents
						const updateData = JSON.parse(fs.readFileSync(vscodeManifestFullPath)); // Read in the set of values to replace from package.vscode.json
						Object.keys(updateData).forEach(key => {
							data[key] = updateData[key];
						});
						// Remove ADS-only menus. This is a subset of the menus listed in https://github.com/microsoft/azuredatastudio/blob/main/src/vs/workbench/api/common/menusExtensionPoint.ts
						// More can be added to the list as needed.
						['objectExplorer/item/context', 'dataExplorer/context', 'dashboard/toolbar'].forEach(menu => {
							delete data.contributes.menus[menu];
						});
						return data;
					}, { beautify: false }))
					.pipe(gulp.dest(packageDir));
				await new Promise(resolve => packageJsonStream.on('finish', resolve)); // Wait for the files to finish being updated before packaging
				const pkgJson = JSON.parse(fs.readFileSync(packageManifestPath));
				const vsixDirectory = path.join(root, '.build', 'extensions');
				const packagePath = path.join(vsixDirectory, `${pkgJson.name}-${pkgJson.version}.vsix`);
				console.info('Creating vsix for ' + packageDir + ' result:' + packagePath);
				return vsce.createVSIX({
					cwd: packageDir,
					packagePath: packagePath,
					useYarn: true
				});
			});

		return Promise.all(vscodeVsixes);
	})
));

gulp.task('package-langpacks', task.series(
	task.define('bundle-external-langpack-build', () => loc.packageLangpacksStream().pipe(gulp.dest('.build/external'))),
	task.define('create-external-langpack-vsix-build', () => {
		const vsixes = glob.sync('.build/external/langpacks/*/package.json').map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		}).map(element => {
			const pkgJson = require(path.join(element.path, 'package.json'));
			const vsixDirectory = path.join(root, '.build', 'langpacks');
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

gulp.task('update-langpacks', task.series(
	task.define('rename-vscode-packs', () => loc.renameVscodeLangpacks()),
	task.define('refresh-langpack-resources', () => loc.refreshLangpacks())
));

