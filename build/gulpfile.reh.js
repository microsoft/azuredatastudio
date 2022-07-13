/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const path = require('path');
const es = require('event-stream');
const util = require('./lib/util');
const task = require('./lib/task');
const common = require('./lib/optimize');
const product = require('../product.json');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const filter = require('gulp-filter');
const _ = require('underscore');
const { getProductionDependencies } = require('./lib/dependencies');
const vfs = require('vinyl-fs');
const packageJson = require('../package.json');
const flatmap = require('gulp-flatmap');
const gunzip = require('gulp-gunzip');
const File = require('vinyl');
const fs = require('fs');
const glob = require('glob');
const { compileBuildTask } = require('./gulpfile.compile');
const { compileExtensionsBuildTask } = require('./gulpfile.extensions');
const { vscodeWebEntryPoints, vscodeWebResourceIncludes, createVSCodeWebFileContentMapper } = require('./gulpfile.vscode.web');
const cp = require('child_process');
const { rollupAngular } = require('./lib/rollup');

const REPO_ROOT = path.dirname(__dirname);
const commit = util.getVersion(REPO_ROOT);
const BUILD_ROOT = path.dirname(REPO_ROOT);
const REMOTE_FOLDER = path.join(REPO_ROOT, 'remote');

// Targets

const BUILD_TARGETS = [
	{ platform: 'win32', arch: 'ia32' },
	{ platform: 'win32', arch: 'x64' },
	{ platform: 'darwin', arch: null },
	{ platform: 'linux', arch: 'ia32' },
	{ platform: 'linux', arch: 'x64' },
	{ platform: 'linux', arch: 'armhf' },
	{ platform: 'linux', arch: 'arm64' },
	{ platform: 'alpine', arch: 'arm64' },
	// legacy: we use to ship only one alpine so it was put in the arch, but now we ship
	// multiple alpine images and moved to a better model (alpine as the platform)
	{ platform: 'linux', arch: 'alpine' },
];

const serverResources = [

	// Bootstrap
	'out-build/bootstrap.js',
	'out-build/bootstrap-fork.js',
	'out-build/bootstrap-amd.js',
	'out-build/bootstrap-node.js',
	'out-build/paths.js',

	// Performance
	'out-build/vs/base/common/performance.js',

	// main entry points
	'out-build/vs/server/cli.js',
	'out-build/vs/server/main.js',

	// Watcher
	'out-build/vs/platform/files/**/*.exe',
	'out-build/vs/platform/files/**/*.md',

	// Uri transformer
	'out-build/vs/server/uriTransformer.js',

	// Process monitor
	'out-build/vs/base/node/cpuUsage.sh',
	'out-build/vs/base/node/ps.sh',

	'!**/test/**'
];

let serverWithWebResources = undefined;
try {
	serverWithWebResources = [

		// Include all of server...
		...serverResources,

		// ...and all of web
		...vscodeWebResourceIncludes
	];
} catch (err) {
	serverWithWebResources = [
		// Include all of server...
		...serverResources
	];
}

const serverEntryPoints = [
	{
		name: 'vs/server/remoteExtensionHostAgent',
		exclude: ['vs/css', 'vs/nls']
	},
	{
		name: 'vs/server/remoteCli',
		exclude: ['vs/css', 'vs/nls']
	},
	{
		name: 'vs/server/remoteExtensionHostProcess',
		exclude: ['vs/css', 'vs/nls']
	},
	{
		name: 'vs/platform/files/node/watcher/nsfw/watcherApp',
		exclude: ['vs/css', 'vs/nls']
	},
	{
		name: 'vs/platform/terminal/node/ptyHostMain',
		exclude: ['vs/css', 'vs/nls']
	}
];

let serverWithWebEntryPoints = undefined;
try {
	serverWithWebEntryPoints = [

		// Include all of server
		...serverEntryPoints,

		// Include workbench web
		...vscodeWebEntryPoints
		];
} catch (err) {
	serverWithWebEntryPoints = [
		// Include all of server
		...serverEntryPoints
	];
}

function getNodeVersion() {
	const yarnrc = fs.readFileSync(path.join(REPO_ROOT, 'remote', '.yarnrc'), 'utf8');
	const target = /^target "(.*)"$/m.exec(yarnrc)[1];
	return target;
}

const nodeVersion = getNodeVersion();

BUILD_TARGETS.forEach(({ platform, arch }) => {
	if (platform === 'darwin') {
		arch = 'x64';
	}

	gulp.task(task.define(`node-${platform}-${arch}`, () => {
		const nodePath = path.join('.build', 'node', `v${nodeVersion}`, `${platform}-${arch}`);

		if (!fs.existsSync(nodePath)) {
			util.rimraf(nodePath);

			return nodejs(platform, arch)
				.pipe(vfs.dest(nodePath));
		}

		return Promise.resolve(null);
	}));
});

const arch = process.platform === 'darwin' ? 'x64' : process.arch;
const defaultNodeTask = gulp.task(`node-${process.platform}-${arch}`);

if (defaultNodeTask) {
	gulp.task(task.define('node', defaultNodeTask));
}

function nodejs(platform, arch) {
	const remote = require('gulp-remote-retry-src');
	const untar = require('gulp-untar');

	if (arch === 'ia32') {
		arch = 'x86';
	}

	if (platform === 'win32') {
		return remote(`/dist/v${nodeVersion}/win-${arch}/node.exe`, { base: 'https://nodejs.org' })
			.pipe(rename('node.exe'));
	}

	if (arch === 'alpine' || platform === 'alpine') {
		const imageName = arch === 'arm64' ? 'arm64v8/node' : 'node';
		const contents = cp.execSync(`docker run --rm ${imageName}:${nodeVersion}-alpine /bin/sh -c 'cat \`which node\`'`, { maxBuffer: 100 * 1024 * 1024, encoding: 'buffer' });
		return es.readArray([new File({ path: 'node', contents, stat: { mode: parseInt('755', 8) } })]);
	}

	if (platform === 'darwin') {
		arch = 'x64';
	}

	if (arch === 'armhf') {
		arch = 'armv7l';
	}

	return remote(`/dist/v${nodeVersion}/node-v${nodeVersion}-${platform}-${arch}.tar.gz`, { base: 'https://nodejs.org' })
		.pipe(flatmap(stream => stream.pipe(gunzip()).pipe(untar())))
		.pipe(filter('**/node'))
		.pipe(util.setExecutableBit('**'))
		.pipe(rename('node'));
}

function packageTask(type, platform, arch, sourceFolderName, destinationFolderName) {
	const destination = path.join(BUILD_ROOT, destinationFolderName);

	return () => {
		const json = require('gulp-json-editor');

		const src = gulp.src(sourceFolderName + '/**', { base: '.' })
			.pipe(rename(function (path) { path.dirname = path.dirname.replace(new RegExp('^' + sourceFolderName), 'out'); }))
			.pipe(util.setExecutableBit(['**/*.sh']))
			.pipe(filter(['**', '!**/*.js.map']));

		const workspaceExtensionPoints = ['debuggers', 'jsonValidation'];
		const isUIExtension = (manifest) => {
			switch (manifest.extensionKind) {
				case 'ui': return true;
				case 'workspace': return false;
				default: {
					if (manifest.main) {
						return false;
					}
					if (manifest.contributes && Object.keys(manifest.contributes).some(key => workspaceExtensionPoints.indexOf(key) !== -1)) {
						return false;
					}
					// Default is UI Extension
					return true;
				}
			}
		};
		const localWorkspaceExtensions = glob.sync('extensions/*/package.json')
			.filter((extensionPath) => {
				if (type === 'reh-web') {
					return true; // web: ship all extensions for now
				}

				const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, extensionPath)).toString());
				return !isUIExtension(manifest);
			}).map((extensionPath) => path.basename(path.dirname(extensionPath)))
			.filter(name => name !== 'vscode-api-tests' && name !== 'vscode-test-resolver'); // Do not ship the test extensions
		const marketplaceExtensions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8')).builtInExtensions
			.filter(entry => !entry.platforms || new Set(entry.platforms).has(platform))
			.filter(entry => !entry.clientOnly)
			.map(entry => entry.name);
		const extensionPaths = [...localWorkspaceExtensions, ...marketplaceExtensions]
			.map(name => `.build/extensions/${name}/**`);

		const extensions = gulp.src(extensionPaths, { base: '.build', dot: true });
		const extensionsCommonDependencies = gulp.src('.build/extensions/node_modules/**', { base: '.build', dot: true });
		const sources = es.merge(src, extensions, extensionsCommonDependencies)
			.pipe(filter(['**', '!**/*.js.map'], { dot: true }));

		let version = packageJson.version;
		const quality = product.quality;

		if (quality && quality !== 'stable') {
			version += '-' + quality;
		}

		const name = product.nameShort;
		const packageJsonStream = gulp.src(['remote/package.json'], { base: 'remote' })
			.pipe(json({ name, version }));

		const date = new Date().toISOString();

		const productJsonStream = gulp.src(['product.json'], { base: '.' })
			.pipe(json({ commit, date }));

		const license = gulp.src(['remote/LICENSE'], { base: 'remote' });

		const jsFilter = util.filter(data => !data.isDirectory() && /\.js$/.test(data.path));

		const productionDependencies = getProductionDependencies(REMOTE_FOLDER);
		const dependenciesSrc = _.flatten(productionDependencies.map(d => path.relative(REPO_ROOT, d.path)).map(d => [`${d}/**`, `!${d}/**/{test,tests}/**`, `!${d}/.bin/**`]));
		const deps = gulp.src(dependenciesSrc, { base: 'remote', dot: true })
			// filter out unnecessary files, no source maps in server build
			.pipe(filter(['**', '!**/package-lock.json', '!**/yarn.lock', '!**/*.js.map']))
			.pipe(util.cleanNodeModules(path.join(__dirname, '.moduleignore')))
			.pipe(jsFilter)
			.pipe(util.stripSourceMappingURL())
			.pipe(jsFilter.restore);

		const nodePath = `.build/node/v${nodeVersion}/${platform}-${platform === 'darwin' ? 'x64' : arch}`;
		const node = gulp.src(`${nodePath}/**`, { base: nodePath, dot: true });

		let web = [];
		if (type === 'reh-web') {
			web = [
				'resources/server/favicon.ico',
				'resources/server/code-192.png',
				'resources/server/code-512.png',
				'resources/server/manifest.json'
			].map(resource => gulp.src(resource, { base: '.' }).pipe(rename(resource)));
		}

		let all = es.merge(
			packageJsonStream,
			productJsonStream,
			license,
			sources,
			deps,
			node,
			...web
		);

		let result = all
			.pipe(util.skipDirectories())
			.pipe(util.fixWin32DirectoryPermissions());

		if (platform === 'win32') {
			result = es.merge(result,
				gulp.src('resources/server/bin/code.cmd', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/${product.applicationName}.cmd`)),
				// gulp.src('resources/server/bin/helpers/browser.cmd', { base: '.' })
				// 	.pipe(replace('@@VERSION@@', version))
				// 	.pipe(replace('@@COMMIT@@', commit))
				// 	.pipe(replace('@@APPNAME@@', product.applicationName))
				// 	.pipe(rename(`bin/helpers/browser.cmd`)),
				gulp.src('resources/server/bin/server.cmd', { base: '.' })
					.pipe(rename(`server.cmd`))
			);
		} else if (platform === 'linux' || platform === 'darwin') {
			result = es.merge(result,
				gulp.src('resources/server/bin/code.sh', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/${product.applicationName}`))
					.pipe(util.setExecutableBit()),
				// gulp.src('resources/server/bin/helpers/browser.sh', { base: '.' })
				// 	.pipe(replace('@@VERSION@@', version))
				// 	.pipe(replace('@@COMMIT@@', commit))
				// 	.pipe(replace('@@APPNAME@@', product.applicationName))
				// 	.pipe(rename(`bin/helpers/browser.sh`))
				// 	.pipe(util.setExecutableBit()),
				gulp.src('resources/server/bin/server.sh', { base: '.' })
					.pipe(rename(`server.sh`))
					.pipe(util.setExecutableBit())
			);
		}

		return result.pipe(vfs.dest(destination));
	};
}

function copyConfigTask(folder) {
	const destination = path.join(BUILD_ROOT, folder);
	return () => {
		const json = require('gulp-json-editor');

		return gulp.src(['remote/pkg-package.json'], { base: 'remote' })
		.pipe(rename(path => path.basename += '.' + folder))
		.pipe(json(obj => {
			const pkg = obj.pkg;
			pkg.scripts = pkg.scripts && pkg.scripts.map(p => path.join(destination, p));
			pkg.assets = pkg.assets && pkg.assets.map(p => path.join(destination, p));
			return obj;
		}))
		.pipe(vfs.dest('out-vscode-reh-pkg'));
	};
}

function copyNativeTask(folder) {
	const destination = path.join(BUILD_ROOT, folder);
	return () => {
		const nativeLibraries = gulp.src(['remote/node_modules/**/*.node']);
		const license = gulp.src(['remote/LICENSE']);

		const result = es.merge(
			nativeLibraries,
			license
		);

		return result
			.pipe(rename({ dirname: '' }))
			.pipe(vfs.dest(destination));
	};
}

function packagePkgTask(platform, arch, pkgTarget) {
	const folder = path.join(BUILD_ROOT, 'vscode-reh') + (platform ? '-' + platform : '') + (arch ? '-' + arch : '');
	return () => {
		const cwd = process.cwd();
		const config = path.join(cwd, 'out-vscode-reh-pkg', 'pkg-package.vscode-reh-' + platform + '-' + arch + '.json');
		process.chdir(folder);
		console.log(`TODO`, pkgTarget, config);
		return null;
		// return pkg.exec(['-t', pkgTarget, '-d', '-c', config, '-o', path.join(folder + '-pkg', platform === 'win32' ? 'vscode-reh.exe' : 'vscode-reh'), './out/remoteExtensionHostAgent.js'])
		// 	.then(() => process.chdir(cwd));
	};
}

['reh', 'reh-web'].forEach(type => {
	const optimizeTask = task.define(`optimize-vscode-${type}`, task.series(
		util.rimraf(`out-vscode-${type}`),
		common.optimizeTask({
			src: 'out-build',
			entryPoints: _.flatten(type === 'reh' ? serverEntryPoints : serverWithWebEntryPoints),
			otherSources: [],
			resources: type === 'reh' ? serverResources : serverWithWebResources,
			loaderConfig: common.loaderConfig(),
			out: `out-vscode-${type}`,
			inlineAmdImages: true,
			bundleInfo: undefined,
			fileContentMapper: createVSCodeWebFileContentMapper ? createVSCodeWebFileContentMapper('.build/extensions') : undefined
		})
	));

	const minifyTask = task.define(`minify-vscode-${type}`, task.series(
		optimizeTask,
		util.rimraf(`out-vscode-${type}-min`),
		common.minifyTask(`out-vscode-${type}`, `https://ticino.blob.core.windows.net/sourcemaps/${commit}/core`)
	));
	gulp.task(minifyTask);

	BUILD_TARGETS.forEach(buildTarget => {
		const dashed = (str) => (str ? `-${str}` : ``);
		const platform = buildTarget.platform;
		const arch = buildTarget.arch;
		const pkgTarget = buildTarget.pkgTarget;

		const copyPkgConfigTask = task.define(`copy-pkg-config${dashed(platform)}${dashed(arch)}`, task.series(
			util.rimraf(`out-vscode-${type}-pkg`),
			copyConfigTask(`vscode-${type}${dashed(platform)}${dashed(arch)}`)
		));

		const copyPkgNativeTask = task.define(`copy-pkg-native${dashed(platform)}${dashed(arch)}`, task.series(
			util.rimraf(path.join(BUILD_ROOT, `vscode-${type}${dashed(platform)}${dashed(arch)}-pkg`)),
			copyNativeTask(`vscode-${type}${dashed(platform)}${dashed(arch)}-pkg`)
		));

		['', 'min'].forEach(minified => {
			const sourceFolderName = `out-vscode-${type}${dashed(minified)}`;
			const destinationFolderName = `vscode-${type}${dashed(platform)}${dashed(arch)}`;

			const rollupAngularTask = task.define(`vscode-web-${type}${dashed(platform)}${dashed(arch)}-angular-rollup`, () => {
				return rollupAngular(REMOTE_FOLDER);
			});
			gulp.task(rollupAngularTask);

			// rebuild extensions that contain native npm modules or have conditional webpack rules
			// when building with the web .yarnrc settings (e.g. runtime=node, etc.)
			// this is needed to have correct module set published with desired ABI
			const rebuildExtensions = ['big-data-cluster', 'mssql', 'notebook'];
			const EXTENSIONS = path.join(REPO_ROOT, 'extensions');
			function exec(cmdLine, cwd) {
				console.log(cmdLine);
				cp.execSync(cmdLine, { stdio: 'inherit', cwd: cwd });
			}
			const tasks = [];
			rebuildExtensions.forEach(scope => {
				const root = path.join(EXTENSIONS, scope);
				tasks.push(
					() => gulp.src(path.join(REMOTE_FOLDER, '.yarnrc')).pipe(gulp.dest(root)),
					util.rimraf(path.join(root, 'node_modules')),
					() => exec('yarn', root)
				);
			});
			const yarnrcExtensions = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}-yarnrc-extensions`, task.series(...tasks));
			gulp.task(yarnrcExtensions);

			const cleanupExtensions = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}-cleanup-extensions`, () => {
				return Promise.all(rebuildExtensions.map(scope => {
					const root = path.join(EXTENSIONS, scope);
					return util.rimraf(path.join(root, '.yarnrc'))();
				}));
			});
			gulp.task(cleanupExtensions);

			const serverTaskCI = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}${dashed(minified)}-ci`, task.series(
				gulp.task(`node-${platform}-${platform === 'darwin' ? 'x64' : arch}`),
				yarnrcExtensions,
				compileExtensionsBuildTask,
				cleanupExtensions,
				rollupAngularTask,
				util.rimraf(path.join(BUILD_ROOT, destinationFolderName)),
				packageTask(type, platform, arch, sourceFolderName, destinationFolderName)
			));
			gulp.task(serverTaskCI);

			const serverTask = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}${dashed(minified)}`, task.series(
				compileBuildTask,
				compileExtensionsBuildTask,
				minified ? minifyTask : optimizeTask,
				serverTaskCI
			));
			gulp.task(serverTask);

			const serverPkgTask = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}${dashed(minified)}-pkg`, task.series(
				task.parallel(
					serverTask,
					copyPkgConfigTask,
					copyPkgNativeTask
				),
				packagePkgTask(platform, arch, pkgTarget)
			));
			gulp.task(serverPkgTask);
		});
	});
});

function packageTask(type, platform, arch, sourceFolderName, destinationFolderName) {
	const destination = path.join(BUILD_ROOT, destinationFolderName);

	return () => {
		const json = require('gulp-json-editor');

		const src = gulp.src(sourceFolderName + '/**', { base: '.' })
			.pipe(rename(function (path) { path.dirname = path.dirname.replace(new RegExp('^' + sourceFolderName), 'out'); }))
			.pipe(util.setExecutableBit(['**/*.sh']))
			.pipe(filter(['**', '!**/*.js.map']));

		const workspaceExtensionPoints = ['debuggers', 'jsonValidation'];
		const isUIExtension = (manifest) => {
			switch (manifest.extensionKind) {
				case 'ui': return true;
				case 'workspace': return false;
				default: {
					if (manifest.main) {
						return false;
					}
					if (manifest.contributes && Object.keys(manifest.contributes).some(key => workspaceExtensionPoints.indexOf(key) !== -1)) {
						return false;
					}
					// Default is UI Extension
					return true;
				}
			}
		};
		const localWorkspaceExtensions = glob.sync('extensions/*/package.json')
			.filter((extensionPath) => {
				if (type === 'reh-web') {
					return true; // web: ship all extensions for now
				}

				const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, extensionPath)).toString());
				return !isUIExtension(manifest);
			}).map((extensionPath) => path.basename(path.dirname(extensionPath)))
			.filter(name => name !== 'vscode-api-tests' && name !== 'vscode-test-resolver'); // Do not ship the test extensions
		const marketplaceExtensions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8')).builtInExtensions
			.filter(entry => !entry.platforms || new Set(entry.platforms).has(platform))
			.filter(entry => !entry.clientOnly)
			.map(entry => entry.name);
		const extensionPaths = [...localWorkspaceExtensions, ...marketplaceExtensions]
			.map(name => `.build/extensions/${name}/**`);

		const extensions = gulp.src(extensionPaths, { base: '.build', dot: true });
		const extensionsCommonDependencies = gulp.src('.build/extensions/node_modules/**', { base: '.build', dot: true });
		const sources = es.merge(src, extensions, extensionsCommonDependencies)
			.pipe(filter(['**', '!**/*.js.map'], { dot: true }));

		let version = packageJson.version;
		const quality = product.quality;

		if (quality && quality !== 'stable') {
			version += '-' + quality;
		}

		const name = product.nameShort;
		const packageJsonStream = gulp.src(['remote/package.json'], { base: 'remote' })
			.pipe(json({ name, version }));

		const date = new Date().toISOString();

		const productJsonStream = gulp.src(['product.json'], { base: '.' })
			.pipe(json({ commit, date }));

		const license = gulp.src(['remote/LICENSE'], { base: 'remote', allowEmpty: true });

		const jsFilter = util.filter(data => !data.isDirectory() && /\.js$/.test(data.path));

		const productionDependencies = getProductionDependencies(REMOTE_FOLDER);
		const dependenciesSrc = _.flatten(productionDependencies.map(d => path.relative(REPO_ROOT, d.path)).map(d => [`${d}/**`, `!${d}/**/{test,tests}/**`, `!${d}/.bin/**`]));
		const deps = gulp.src(dependenciesSrc, { base: 'remote', dot: true })
			// filter out unnecessary files, no source maps in server build
			.pipe(filter(['**', '!**/package-lock.json', '!**/yarn.lock', '!**/*.js.map']))
			.pipe(util.cleanNodeModules(path.join(__dirname, '.moduleignore')))
			.pipe(jsFilter)
			.pipe(util.stripSourceMappingURL())
			.pipe(jsFilter.restore);

		const nodePath = `.build/node/v${nodeVersion}/${platform}-${platform === 'darwin' ? 'x64' : arch}`;
		const node = gulp.src(`${nodePath}/**`, { base: nodePath, dot: true });

		let web = [];
		if (type === 'reh-web') {
			web = [
				'resources/server/favicon.ico',
				'resources/server/code-192.png',
				'resources/server/code-512.png',
				'resources/server/manifest.json'
			].map(resource => gulp.src(resource, { base: '.' }).pipe(rename(resource)));
		}

		let all = es.merge(
			packageJsonStream,
			productJsonStream,
			license,
			sources,
			deps,
			node,
			...web
		);

		let result = all
			.pipe(util.skipDirectories())
			.pipe(util.fixWin32DirectoryPermissions());

		if (platform === 'win32') {
			result = es.merge(result,
				gulp.src('resources/server/bin/code.cmd', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/${product.applicationName}.cmd`)),
				gulp.src('resources/server/bin/helpers/browser.cmd', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/helpers/browser.cmd`)),
				gulp.src('resources/server/bin/server.cmd', { base: '.' })
					.pipe(rename(`server.cmd`))
			);
		} else if (platform === 'linux' || platform === 'alpine' || platform === 'darwin') {
			result = es.merge(result,
				gulp.src('resources/server/bin/code.sh', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/${product.applicationName}`))
					.pipe(util.setExecutableBit()),
				gulp.src('resources/server/bin/helpers/browser.sh', { base: '.' })
					.pipe(replace('@@VERSION@@', version))
					.pipe(replace('@@COMMIT@@', commit))
					.pipe(replace('@@APPNAME@@', product.applicationName))
					.pipe(rename(`bin/helpers/browser.sh`))
					.pipe(util.setExecutableBit()),
				gulp.src('resources/server/bin/server.sh', { base: '.' })
					.pipe(rename(`server.sh`))
					.pipe(util.setExecutableBit())
			);
		}

		return result.pipe(vfs.dest(destination));
	};
}

['reh', 'reh-web'].forEach(type => {
	const optimizeTask = task.define(`optimize-vscode-${type}`, task.series(
		util.rimraf(`out-vscode-${type}`),
		common.optimizeTask({
			src: 'out-build',
			entryPoints: _.flatten(type === 'reh' ? serverEntryPoints : serverWithWebEntryPoints),
			otherSources: [],
			resources: type === 'reh' ? serverResources : serverWithWebResources,
			loaderConfig: common.loaderConfig(),
			out: `out-vscode-${type}`,
			inlineAmdImages: true,
			bundleInfo: undefined,
			fileContentMapper: createVSCodeWebFileContentMapper('.build/extensions')
		})
	));

	const minifyTask = task.define(`minify-vscode-${type}`, task.series(
		optimizeTask,
		util.rimraf(`out-vscode-${type}-min`),
		common.minifyTask(`out-vscode-${type}`, `https://ticino.blob.core.windows.net/sourcemaps/${commit}/core`)
	));
	gulp.task(minifyTask);

	BUILD_TARGETS.forEach(buildTarget => {
		const dashed = (str) => (str ? `-${str}` : ``);
		const platform = buildTarget.platform;
		const arch = buildTarget.arch;

		['', 'min'].forEach(minified => {
			const sourceFolderName = `out-vscode-${type}${dashed(minified)}`;
			const destinationFolderName = `vscode-${type}${dashed(platform)}${dashed(arch)}`;

			const serverTaskCI = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}${dashed(minified)}-ci`, task.series(
				gulp.task(`node-${platform}-${platform === 'darwin' ? 'x64' : arch}`),
				util.rimraf(path.join(BUILD_ROOT, destinationFolderName)),
				packageTask(type, platform, arch, sourceFolderName, destinationFolderName)
			));
			gulp.task(serverTaskCI);

			const serverTask = task.define(`vscode-${type}${dashed(platform)}${dashed(arch)}${dashed(minified)}`, task.series(
				compileBuildTask,
				compileExtensionsBuildTask,
				minified ? minifyTask : optimizeTask,
				serverTaskCI
			));
			gulp.task(serverTask);
		});
	});
});
