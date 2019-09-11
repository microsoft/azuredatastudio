/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as fs from 'fs';
import * as glob from 'glob';
import * as gulp from 'gulp';
import * as path from 'path';
import { Stream } from 'stream';
import * as File from 'vinyl';
import * as vsce from 'vsce';
import { createStatsStream } from './stats';
import * as util2 from './util';
import remote = require('gulp-remote-retry-src');
const vzip = require('gulp-vinyl-zip');
import filter = require('gulp-filter');
import rename = require('gulp-rename');
import * as fancyLog from 'fancy-log';
import * as ansiColors from 'ansi-colors';
const buffer = require('gulp-buffer');
import json = require('gulp-json-editor');
const webpack = require('webpack');
const webpackGulp = require('webpack-stream');
const util = require('./util');
const root = path.dirname(path.dirname(__dirname));
const commit = util.getVersion(root);
const sourceMappingURLBase = `https://ticino.blob.core.windows.net/sourcemaps/${commit}`;

function fromLocal(extensionPath: string): Stream {
	const webpackFilename = path.join(extensionPath, 'extension.webpack.config.js');
	const input = fs.existsSync(webpackFilename)
		? fromLocalWebpack(extensionPath)
		: fromLocalNormal(extensionPath);

	const tmLanguageJsonFilter = filter('**/*.tmLanguage.json', { restore: true });

	return input
		.pipe(tmLanguageJsonFilter)
		.pipe(buffer())
		.pipe(es.mapSync((f: File) => {
			f.contents = Buffer.from(JSON.stringify(JSON.parse(f.contents.toString('utf8'))));
			return f;
		}))
		.pipe(tmLanguageJsonFilter.restore);
}

function fromLocalWebpack(extensionPath: string): Stream {
	const result = es.through();

	const packagedDependencies: string[] = [];
	const packageJsonConfig = require(path.join(extensionPath, 'package.json'));
	if (packageJsonConfig.dependencies) {
		const webpackRootConfig = require(path.join(extensionPath, 'extension.webpack.config.js'));
		for (const key in webpackRootConfig.externals) {
			if (key in packageJsonConfig.dependencies) {
				packagedDependencies.push(key);
			}
		}
	}

	vsce.listFiles({ cwd: extensionPath, packageManager: vsce.PackageManager.Yarn, packagedDependencies }).then(fileNames => {
		const files = fileNames
			.map(fileName => path.join(extensionPath, fileName))
			.map(filePath => new File({
				path: filePath,
				stat: fs.statSync(filePath),
				base: extensionPath,
				contents: fs.createReadStream(filePath) as any
			}));

		const filesStream = es.readArray(files);

		// check for a webpack configuration files, then invoke webpack
		// and merge its output with the files stream. also rewrite the package.json
		// file to a new entry point
		const webpackConfigLocations = (<string[]>glob.sync(
			path.join(extensionPath, '/**/extension.webpack.config.js'),
			{ ignore: ['**/node_modules'] }
		));

		const packageJsonFilter = filter(f => {
			if (path.basename(f.path) === 'package.json') {
				// only modify package.json's next to the webpack file.
				// to be safe, use existsSync instead of path comparison.
				return fs.existsSync(path.join(path.dirname(f.path), 'extension.webpack.config.js'));
			}
			return false;
		}, { restore: true });

		const patchFilesStream = filesStream
			.pipe(packageJsonFilter)
			.pipe(buffer())
			.pipe(json((data: any) => {
				if (data.main) {
					// hardcoded entry point directory!
					data.main = data.main.replace('/out/', /dist/);
				}
				return data;
			}))
			.pipe(packageJsonFilter.restore);


		const webpackStreams = webpackConfigLocations.map(webpackConfigPath => {

			const webpackDone = (err: any, stats: any) => {
				fancyLog(`Bundled extension: ${ansiColors.yellow(path.join(path.basename(extensionPath), path.relative(extensionPath, webpackConfigPath)))}...`);
				if (err) {
					result.emit('error', err);
				}
				const { compilation } = stats;
				if (compilation.errors.length > 0) {
					result.emit('error', compilation.errors.join('\n'));
				}
				if (compilation.warnings.length > 0) {
					result.emit('error', compilation.warnings.join('\n'));
				}
			};

			const webpackConfig = {
				...require(webpackConfigPath),
				...{ mode: 'production' }
			};
			const relativeOutputPath = path.relative(extensionPath, webpackConfig.output.path);

			return webpackGulp(webpackConfig, webpack, webpackDone)
				.pipe(es.through(function (data) {
					data.stat = data.stat || {};
					data.base = extensionPath;
					this.emit('data', data);
				}))
				.pipe(es.through(function (data: File) {
					// source map handling:
					// * rewrite sourceMappingURL
					// * save to disk so that upload-task picks this up
					const contents = (<Buffer>data.contents).toString('utf8');
					data.contents = Buffer.from(contents.replace(/\n\/\/# sourceMappingURL=(.*)$/gm, function (_m, g1) {
						return `\n//# sourceMappingURL=${sourceMappingURLBase}/extensions/${path.basename(extensionPath)}/${relativeOutputPath}/${g1}`;
					}), 'utf8');

					this.emit('data', data);
				}));
		});

		es.merge(...webpackStreams, patchFilesStream)
			// .pipe(es.through(function (data) {
			// 	// debug
			// 	console.log('out', data.path, data.contents.length);
			// 	this.emit('data', data);
			// }))
			.pipe(result);

	}).catch(err => {
		console.error(extensionPath);
		console.error(packagedDependencies);
		result.emit('error', err);
	});

	return result.pipe(createStatsStream(path.basename(extensionPath)));
}

function fromLocalNormal(extensionPath: string): Stream {
	const result = es.through();

	vsce.listFiles({ cwd: extensionPath, packageManager: vsce.PackageManager.Yarn })
		.then(fileNames => {
			const files = fileNames
				.map(fileName => path.join(extensionPath, fileName))
				.map(filePath => new File({
					path: filePath,
					stat: fs.statSync(filePath),
					base: extensionPath,
					contents: fs.createReadStream(filePath) as any
				}));

			es.readArray(files).pipe(result);
		})
		.catch(err => result.emit('error', err));

	return result.pipe(createStatsStream(path.basename(extensionPath)));
}

const baseHeaders = {
	'X-Market-Client-Id': 'VSCode Build',
	'User-Agent': 'VSCode Build',
	'X-Market-User-Id': '291C1CD0-051A-4123-9B4B-30D60EF52EE2',
};

export function fromMarketplace(extensionName: string, version: string, metadata: any): Stream {
	// {{SQL CARBON EDIT}}
	const [, name] = extensionName.split('.');
	const url = `https://sqlopsextensions.blob.core.windows.net/extensions/${name}/${name}-${version}.vsix`;

	fancyLog('Downloading extension:', ansiColors.yellow(`${extensionName}@${version}`), '...');

	const options = {
		base: url,
		requestOptions: {
			gzip: true,
			headers: baseHeaders
		}
	};

	const packageJsonFilter = filter('package.json', { restore: true });

	return remote('', options)
		.pipe(vzip.src())
		.pipe(filter('extension/**'))
		.pipe(rename(p => p.dirname = p.dirname!.replace(/^extension\/?/, '')))
		.pipe(packageJsonFilter)
		.pipe(buffer())
		.pipe(json({ __metadata: metadata }))
		.pipe(packageJsonFilter.restore);
}

const excludedExtensions = [
	'vscode-api-tests',
	'vscode-colorize-tests',
	'vscode-test-resolver',
	'ms-vscode.node-debug',
	'ms-vscode.node-debug2',
	// {{SQL CARBON EDIT}}
	'integration-tests'
];

// {{SQL CARBON EDIT}}
const sqlBuiltInExtensions = [
	// Add SQL built-in extensions here.
	// the extension will be excluded from SQLOps package and will have separate vsix packages
	'admin-tool-ext-win',
	'agent',
	'import',
	'profiler',
	'admin-pack',
	'dacpac',
	'schema-compare',
	'cms',
	'query-history'
];

// make resource deployment and BDC extension only available in insiders
if (process.env['VSCODE_QUALITY'] === 'stable') {
	sqlBuiltInExtensions.push('resource-deployment');
	sqlBuiltInExtensions.push('big-data-cluster');
}


interface IBuiltInExtension {
	name: string;
	version: string;
	repo: string;
	metadata: any;
}

const builtInExtensions: IBuiltInExtension[] = process.env['VSCODE_QUALITY'] === 'stable' ? require('../builtInExtensions.json') : require('../builtInExtensions-insiders.json');

// {{SQL CARBON EDIT}} - End


export function packageLocalExtensionsStream(): NodeJS.ReadWriteStream {
	const localExtensionDescriptions = (<string[]>glob.sync('extensions/*/package.json'))
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})
		.filter(({ name }) => excludedExtensions.indexOf(name) === -1)
		.filter(({ name }) => builtInExtensions.every(b => b.name !== name))
		.filter(({ name }) => sqlBuiltInExtensions.indexOf(name) === -1); // {{SQL CARBON EDIT}} add aditional filter

	const nodeModules = gulp.src('extensions/node_modules/**', { base: '.' });
	const localExtensions = localExtensionDescriptions.map(extension => {
		return fromLocal(extension.path)
			.pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
	});

	return es.merge(nodeModules, ...localExtensions)
		.pipe(util2.setExecutableBit(['**/*.sh']));
}

export function packageMarketplaceExtensionsStream(): NodeJS.ReadWriteStream {
	const extensions = builtInExtensions.map(extension => {
		return fromMarketplace(extension.name, extension.version, extension.metadata)
			.pipe(rename(p => p.dirname = `extensions/${extension.name}/${p.dirname}`));
	});

	return es.merge(extensions)
		.pipe(util2.setExecutableBit(['**/*.sh']));
}

// {{SQL CARBON EDIT}}
import * as _ from 'underscore';
import * as vfs from 'vinyl-fs';

export function packageBuiltInExtensions() {
	const sqlBuiltInLocalExtensionDescriptions = glob.sync('extensions/*/package.json')
		.map(manifestPath => {
			const extensionPath = path.dirname(path.join(root, manifestPath));
			const extensionName = path.basename(extensionPath);
			return { name: extensionName, path: extensionPath };
		})
		.filter(({ name }) => excludedExtensions.indexOf(name) === -1)
		.filter(({ name }) => builtInExtensions.every(b => b.name !== name))
		.filter(({ name }) => sqlBuiltInExtensions.indexOf(name) >= 0);
	const visxDirectory = path.join(path.dirname(root), 'vsix');
	try {
		if (!fs.existsSync(visxDirectory)) {
			fs.mkdirSync(visxDirectory);
		}
	} catch (err) {
		// don't fail the build if the output directory already exists
		console.warn(err);
	}
	sqlBuiltInLocalExtensionDescriptions.forEach(element => {
		let pkgJson = JSON.parse(fs.readFileSync(path.join(element.path, 'package.json'), { encoding: 'utf8' }));
		const packagePath = path.join(visxDirectory, `${pkgJson.name}-${pkgJson.version}.vsix`);
		console.info('Creating vsix for ' + element.path + ' result:' + packagePath);
		vsce.createVSIX({
			cwd: element.path,
			packagePath: packagePath,
			useYarn: true
		});
	});
}

export function packageExtensionTask(extensionName: string, platform: string, arch: string) {
	var destination = path.join(path.dirname(root), 'azuredatastudio') + (platform ? '-' + platform : '') + (arch ? '-' + arch : '');
	if (platform === 'darwin') {
		destination = path.join(destination, 'Azure Data Studio.app', 'Contents', 'Resources', 'app', 'extensions', extensionName);
	} else {
		destination = path.join(destination, 'resources', 'app', 'extensions', extensionName);
	}

	platform = platform || process.platform;

	return () => {
		const root = path.resolve(path.join(__dirname, '../..'));
		const localExtensionDescriptions = glob.sync('extensions/*/package.json')
			.map(manifestPath => {
				const extensionPath = path.dirname(path.join(root, manifestPath));
				const extensionName = path.basename(extensionPath);
				return { name: extensionName, path: extensionPath };
			})
			.filter(({ name }) => extensionName === name);

		const localExtensions = es.merge(...localExtensionDescriptions.map(extension => {
			return fromLocal(extension.path);
		}));

		let result = localExtensions
			.pipe(util2.skipDirectories())
			.pipe(util2.fixWin32DirectoryPermissions())
			.pipe(filter(['**', '!LICENSE', '!LICENSES.chromium.html', '!version']));

		return result.pipe(vfs.dest(destination));
	};
}
// {{SQL CARBON EDIT}} - End