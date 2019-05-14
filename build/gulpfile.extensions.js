/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Increase max listeners for event emitters
require('events').EventEmitter.defaultMaxListeners = 100;

const gulp = require('gulp');
const path = require('path');
const tsb = require('gulp-tsb');
const es = require('event-stream');
const filter = require('gulp-filter');
const util = require('./lib/util');
const task = require('./lib/task');
const watcher = require('./lib/watch');
const createReporter = require('./lib/reporter').createReporter;
const glob = require('glob');
const sourcemaps = require('gulp-sourcemaps');
const nlsDev = require('vscode-nls-dev');
const root = path.dirname(__dirname);
const commit = util.getVersion(root);
const plumber = require('gulp-plumber');
const _ = require('underscore');

const extensionsPath = path.join(path.dirname(__dirname), 'extensions');

/**Use of 'debug' allows one to emit console (error stream by default) on demand.
 *  By default nothing is emitted unless environment variable DEBUG is defined.
 * @see https://www.npmjs.com/package/debug
 */
const trace = require('debug')(`gc:${path.basename(extensionsPath)}:trace`);

const compilations = glob.sync('**/tsconfig.json', {
	cwd: extensionsPath,
	ignore: ['**/out/**', '**/node_modules/**']
});

const getBaseUrl = out => `https://ticino.blob.core.windows.net/sourcemaps/${commit}/${out}`;

const tasks = compilations.map(function (tsconfigFile) {
	const absolutePath = path.join(extensionsPath, tsconfigFile);
	const relativeDirname = path.dirname(tsconfigFile);
	const trace = require('debug')(`gc:${path.basename(extensionsPath)}:${relativeDirname}:trace`);

	const tsconfig = require(absolutePath);
	trace(`tsconfig=${JSON.stringify(tsconfig, undefined, '\t')}`);
	const tsOptions = _.assign({}, tsconfig.extends ? require(path.join(extensionsPath, relativeDirname, tsconfig.extends)).compilerOptions : {}, tsconfig.compilerOptions);
	tsOptions.verbose = tsOptions.verbose || false;
	tsOptions.sourceMap = true;
	const outDir = tsOptions.outDir || 'out';
	trace(`tsOptions=${JSON.stringify(tsOptions, undefined, '\t')}`);

	const name = relativeDirname.replace(/\//g, '-');

	const root = path.join('extensions', relativeDirname);
	const srcBase = path.join(root, 'src');
	const src = path.join(srcBase, '**');
	const out = path.join(root, outDir);
	const baseUrl = getBaseUrl(out);
	trace(`name=${name}\nroot=${root}\nsrcBase=${srcBase}\nout=${out}\nbaseUrl=${baseUrl}`);
	let headerId, headerOut;
	let index = relativeDirname.indexOf('/');
	if (index < 0) {
		headerId = 'vscode.' + relativeDirname;
		headerOut = outDir;
	} else {
		headerId = 'vscode.' + relativeDirname.substr(0, index);
		headerOut = path.join(`${relativeDirname.substr(index + 1)}`, outDir);
	}
	trace(`headerId=${headerId}\nheaderOut=${headerOut}`);

	function createPipeline(build, emitError) {
		const reporter = createReporter();

		tsOptions.inlineSources = !!build;
		tsOptions.base = path.dirname(absolutePath);
		const trace = require('debug')(`gc:${path.basename(path.dirname(tsOptions.base))}/${path.basename(tsOptions.base)}:trace`);

		trace(`tsOptions=${JSON.stringify(tsOptions, undefined, '\t')}`);

		const compilation = tsb.create(tsOptions, null, null, err => reporter(err.toString()));
		trace(`compilation=${JSON.stringify(compilation, undefined, '\t')}`);

		return function () {
			const input = es.through();
			trace(`input=${JSON.stringify(input, undefined, '\t')}`);
			const tsFilter = filter(['**/*.ts', '!**/lib/lib*.d.ts', '!**/node_modules/**'], { restore: true });
			trace(`tsFilter=${JSON.stringify(tsFilter, undefined, '\t')}`);
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
			trace(`output=${JSON.stringify(output, undefined, '\t')}`);
			return es.duplex(input, output);
		};
	}

	const srcOpts = { cwd: path.dirname(__dirname), base: srcBase };
	trace(`srcOpts=${JSON.stringify(srcOpts, undefined, '\t')}`);

	const cleanTask = task.define(`clean-extension-${name}`, util.rimraf(out));
	trace(`cleanTask=${JSON.stringify(cleanTask, undefined, '\t')}`);

	const compileTask = task.define(`compile-extension:${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(false, true);
		const input = gulp.src(src, srcOpts);

		return input
			.pipe(pipeline())
			.pipe(gulp.dest(out));
	}));
	trace(`compileTask=${JSON.stringify(compileTask, undefined, '\t')}`);

	const watchTask = task.define(`watch-extension:${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(false);
		const input = gulp.src(src, srcOpts);
		const watchInput = watcher(src, srcOpts);

		return watchInput
			.pipe(util.incremental(pipeline, input))
			.pipe(gulp.dest(out));
	}));
	trace(`watchTask=${JSON.stringify(watchTask, undefined, '\t')}`);

	const compileBuildTask = task.define(`compile-build-extension-${name}`, task.series(cleanTask, () => {
		const pipeline = createPipeline(true, true);
		const input = gulp.src(src, srcOpts);

		return input
			.pipe(pipeline())
			.pipe(gulp.dest(out));
	}));
	trace(`compileBuildTask=${JSON.stringify(compileBuildTask, undefined, '\t')}`);

	// Tasks
	gulp.task(compileTask);
	gulp.task(watchTask);

	return {
		compileTask: compileTask,
		watchTask: watchTask,
		compileBuildTask: compileBuildTask
	};
});

const compileExtensionsTask = task.define('compile-extensions', task.parallel(...tasks.map(t => t.compileTask)));
trace(`compileExtensionsTask=${JSON.stringify(compileExtensionsTask, undefined, '\t')}`);
gulp.task(compileExtensionsTask);
exports.compileExtensionsTask = compileExtensionsTask;

const watchExtensionsTask = task.define('watch-extensions', task.parallel(...tasks.map(t => t.watchTask)));
trace(`watchExtensionsTask=${JSON.stringify(watchExtensionsTask, undefined, '\t')}`);
gulp.task(watchExtensionsTask);
exports.watchExtensionsTask = watchExtensionsTask;

const compileExtensionsBuildTask = task.define('compile-extensions-build', task.parallel(...tasks.map(t => t.compileBuildTask)));
trace(`compileExtensionsBuildTask=${JSON.stringify(compileExtensionsBuildTask, undefined, '\t')}`);
exports.compileExtensionsBuildTask = compileExtensionsBuildTask;
