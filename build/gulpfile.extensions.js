/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Increase max listeners for event emitters
require('events').EventEmitter.defaultMaxListeners = 100;

const gulp = require('gulp');
const path = require('path');
const nodeUtil = require('util');
const es = require('event-stream');
const filter = require('gulp-filter');
const util = require('./lib/util');
const task = require('./lib/task');
const watcher = require('./lib/watch');
const createReporter = require('./lib/reporter').createReporter;
const glob = require('glob');
const root = path.dirname(__dirname);
const commit = util.getVersion(root);
const plumber = require('gulp-plumber');
const ext = require('./lib/extensions');

const extensionsPath = path.join(path.dirname(__dirname), 'extensions');

// {{SQL CARBON EDIT}} - TODO: Import needs to be updated to work with langpacks.
const sqlLocalizedExtensions = [
	'import',
];

// {{SQL CARBON EDIT}} Not doing this for us right now
// To save 250ms for each gulp startup, we are caching the result here
const compilations = glob.sync('**/tsconfig.json', {
	cwd: extensionsPath,
	ignore: ['**/out/**', '**/node_modules/**']
});
// const compilations = [
// 	'configuration-editing/build/tsconfig.json',
// 	'configuration-editing/tsconfig.json',
// 	'css-language-features/client/tsconfig.json',
// 	'css-language-features/server/tsconfig.json',
// 	'debug-auto-launch/tsconfig.json',
// 	'debug-server-ready/tsconfig.json',
// 	'emmet/tsconfig.json',
// 	'extension-editing/tsconfig.json',
// 	'git/tsconfig.json',
// 	'github-authentication/tsconfig.json',
// 	'github/tsconfig.json',
// 	'grunt/tsconfig.json',
// 	'gulp/tsconfig.json',
// 	'html-language-features/client/tsconfig.json',
// 	'html-language-features/server/tsconfig.json',
// 	'image-preview/tsconfig.json',
// 	'jake/tsconfig.json',
// 	'json-language-features/client/tsconfig.json',
// 	'json-language-features/server/tsconfig.json',
// 	'markdown-language-features/preview-src/tsconfig.json',
// 	'markdown-language-features/tsconfig.json',
// 	'markdown-math/tsconfig.json',
// 	'merge-conflict/tsconfig.json',
// 	'microsoft-authentication/tsconfig.json',
// 	'npm/tsconfig.json',
// 	'php-language-features/tsconfig.json',
// 	'search-result/tsconfig.json',
// 	'simple-browser/tsconfig.json',
// 	'testing-editor-contributions/tsconfig.json',
// 	'typescript-language-features/test-workspace/tsconfig.json',
// 	'typescript-language-features/tsconfig.json',
// 	'vscode-api-tests/tsconfig.json',
// 	'vscode-colorize-tests/tsconfig.json',
// 	'vscode-custom-editor-tests/tsconfig.json',
// 	'vscode-notebook-tests/tsconfig.json',
// 	'vscode-test-resolver/tsconfig.json'
// ];

const getBaseUrl = out => `https://sqlopsbuilds.blob.core.windows.net/sourcemaps/${commit}/${out}`;

const tasks = compilations.map(function (tsconfigFile) {
	const absolutePath = path.join(extensionsPath, tsconfigFile);
	const relativeDirname = path.dirname(tsconfigFile);

	const overrideOptions = {};
	overrideOptions.sourceMap = true;

	const name = relativeDirname.replace(/\//g, '-');

	const root = path.join('extensions', relativeDirname);
	const srcBase = path.join(root, 'src');
	const src = path.join(srcBase, '**');
	const srcOpts = { cwd: path.dirname(__dirname), base: srcBase };

	const out = path.join(root, 'out');
	const baseUrl = getBaseUrl(out);

	let headerId, headerOut;
	let index = relativeDirname.indexOf('/');
	if (index < 0) {
		headerId = 'microsoft.' + relativeDirname; // {{SQL CARBON EDIT}}
		headerOut = 'out';
	} else {
		headerId = 'microsoft.' + relativeDirname.substr(0, index); // {{SQL CARBON EDIT}}
		headerOut = relativeDirname.substr(index + 1) + '/out';
	}

	function createPipeline(build, emitError) {
		const nlsDev = require('vscode-nls-dev');
		const tsb = require('gulp-tsb');
		const sourcemaps = require('gulp-sourcemaps');

		const reporter = createReporter('extensions');

		overrideOptions.inlineSources = Boolean(build);
		overrideOptions.base = path.dirname(absolutePath);

		const compilation = tsb.create(absolutePath, overrideOptions, false, err => reporter(err.toString()));

		const pipeline = function () {
			const input = es.through();
			const tsFilter = filter(['**/*.ts', '!**/lib/lib*.d.ts', '!**/node_modules/**'], { restore: true });
			const output = input
				.pipe(plumber({
					errorHandler: function (err) {
						if (err && !err.__reporter__) {
							reporter(err);
						}
					}
				}))
				.pipe(tsFilter)
				.pipe(util.loadSourcemaps())
				.pipe(compilation())
				.pipe(build ? nlsDev.rewriteLocalizeCalls() : es.through())
				.pipe(build ? util.stripSourceMappingURL() : es.through())
				.pipe(sourcemaps.write('.', {
					sourceMappingURL: !build ? null : f => `${baseUrl}/${f.relative}.map`,
					addComment: !!build,
					includeContent: !!build,
					sourceRoot: '../src'
				}))
				.pipe(tsFilter.restore)
				.pipe(build ? nlsDev.bundleMetaDataFiles(headerId, headerOut) : es.through())
				// Filter out *.nls.json file. We needed them only to bundle meta data file.
				.pipe(filter(['**', '!**/*.nls.json']))
				.pipe(reporter.end(emitError));

			return es.duplex(input, output);
		};

		// add src-stream for project files
		pipeline.tsProjectSrc = () => {
			return compilation.src(srcOpts);
		};
		return pipeline;
	}

	const cleanTask = task.define(`clean-extension-${name}`, util.rimraf(out));

	const compileTask = task.define(`compile-extension:${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(sqlLocalizedExtensions.includes(name), true); // {{SQL CARBON EDIT}}
		const nonts = gulp.src(src, srcOpts).pipe(filter(['**', '!**/*.ts']));
		const input = es.merge(nonts, pipeline.tsProjectSrc());

		return input
			.pipe(pipeline())
			.pipe(gulp.dest(out));
	}));

	const watchTask = task.define(`watch-extension:${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(false);
		const nonts = gulp.src(src, srcOpts).pipe(filter(['**', '!**/*.ts']));
		const input = es.merge(nonts, pipeline.tsProjectSrc());
		const watchInput = watcher(src, { ...srcOpts, ...{ readDelay: 200 } });

		return watchInput
			.pipe(util.incremental(pipeline, input))
			.pipe(gulp.dest(out));
	}));

	const compileBuildTask = task.define(`compile-build-extension-${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(true, true);
		const nonts = gulp.src(src, srcOpts).pipe(filter(['**', '!**/*.ts']));
		const input = es.merge(nonts, pipeline.tsProjectSrc());

		return input
			.pipe(pipeline())
			.pipe(gulp.dest(out));
	}));

	// Tasks
	gulp.task(compileTask);
	gulp.task(watchTask);

	return { compileTask, watchTask, compileBuildTask };
});

const compileExtensionsTask = task.define('compile-extensions', task.parallel(...tasks.map(t => t.compileTask)));
gulp.task(compileExtensionsTask);
exports.compileExtensionsTask = compileExtensionsTask;

const watchExtensionsTask = task.define('watch-extensions', task.parallel(...tasks.map(t => t.watchTask)));
gulp.task(watchExtensionsTask);
exports.watchExtensionsTask = watchExtensionsTask;

const compileExtensionsBuildLegacyTask = task.define('compile-extensions-build-legacy', task.parallel(...tasks.map(t => t.compileBuildTask)));
gulp.task(compileExtensionsBuildLegacyTask);

//#region Extension media

const compileExtensionMediaTask = task.define('compile-extension-media', () => ext.buildExtensionMedia(false));
gulp.task(compileExtensionMediaTask);
exports.compileExtensionMediaTask = compileExtensionMediaTask;

const watchExtensionMedia = task.define('watch-extension-media', () => ext.buildExtensionMedia(true));
gulp.task(watchExtensionMedia);
exports.watchExtensionMedia = watchExtensionMedia;

const compileExtensionMediaBuildTask = task.define('compile-extension-media-build', () => ext.buildExtensionMedia(false, '.build/extensions'));
gulp.task(compileExtensionMediaBuildTask);

//#endregion

//#region Azure Pipelines

const cleanExtensionsBuildTask = task.define('clean-extensions-build', util.rimraf('.build/extensions'));
const compileExtensionsBuildTask = task.define('compile-extensions-build', task.series(
	cleanExtensionsBuildTask,
	task.define('bundle-extensions-build', () => ext.packageLocalExtensionsStream(false).pipe(gulp.dest('.build'))),
	task.define('bundle-marketplace-extensions-build', () => ext.packageMarketplaceExtensionsStream(false).pipe(gulp.dest('.build'))),
));

gulp.task(compileExtensionsBuildTask);
gulp.task(task.define('extensions-ci', task.series(compileExtensionsBuildTask, compileExtensionMediaBuildTask)));

exports.compileExtensionsBuildTask = compileExtensionsBuildTask;

//#endregion

// {{SQL CARBON EDIT}}
//#region XLF Creation

//Get every extension in 'extensions' to create XLF files.
const exportCompilations = glob.sync('**/package.json', {
	cwd: extensionsPath,
	ignore: ['**/out/**', '**/node_modules/**', 'package.json']
});

//Run the localization packaging task on all extensions in ADS.
const exportTasks = exportCompilations.map(function (packageFile) {
	const locFunc = require('./lib/locFunc');
	const relativeDirname = path.dirname(packageFile);

	const extensionName = relativeDirname.replace(/\//g, '-');
	const packageTask = task.define(`localization-package-extension:${extensionName}`, task.series(() => {
		return locFunc.packageSingleExtensionStream(extensionName)
			.pipe(gulp.dest('.build'));
	}));

	// Tasks
	gulp.task(packageTask);

	return { packageTask };
});

const packageLocalizationExtensionsTask = task.define('package-localization-extensions-task', task.series(...exportTasks.map(t => t.packageTask)));
gulp.task(packageLocalizationExtensionsTask);

//Builds all ADS extensions including external/excluded extensions (only for creating XLF files, not for compiling extensions for shipping)
const compileLocalizationExtensionsBuildTask = task.define('compile-localization-extensions-build', task.series(
	cleanExtensionsBuildTask,
	compileExtensionsTask,
	task.define('bundle-marketplace-extensions-build', () => ext.packageMarketplaceExtensionsStream(false).pipe(gulp.dest('.build'))),
	packageLocalizationExtensionsTask,
));

gulp.task(compileLocalizationExtensionsBuildTask);
exports.compileLocalizationExtensionsBuildTask = compileLocalizationExtensionsBuildTask;

//#endregion
// {{SQL CARBON EDIT}} end

const compileWebExtensionsTask = task.define('compile-web', () => buildWebExtensions(false));
gulp.task(compileWebExtensionsTask);
exports.compileWebExtensionsTask = compileWebExtensionsTask;

const watchWebExtensionsTask = task.define('watch-web', () => buildWebExtensions(true));
gulp.task(watchWebExtensionsTask);
exports.watchWebExtensionsTask = watchWebExtensionsTask;

async function buildWebExtensions(isWatch) {
	const webpackConfigLocations = await nodeUtil.promisify(glob)(
		path.join(extensionsPath, '**', 'extension-browser.webpack.config.js'),
		{ ignore: ['**/node_modules'] }
	);
	return ext.webpackExtensions('packaging web extension', isWatch, webpackConfigLocations.map(configPath => ({ configPath })));
}
