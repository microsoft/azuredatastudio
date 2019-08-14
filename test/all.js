/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*eslint-env mocha*/
/*global define,run*/

const assert = require('assert');
const path = require('path');
const glob = require('glob');
const jsdom = require('jsdom-no-contextify');
const TEST_GLOB = '**/test/**/*.test.js|**/sqltest/**/*.test.js';
const coverage = require('./coverage');

var optimist = require('optimist')
	.usage('Run the Code tests. All mocha options apply.')
	.describe('build', 'Run from out-build').boolean('build')
	.describe('run', 'Run a single file').string('run')
	.describe('coverage', 'Generate a coverage report').boolean('coverage')
	.describe('only-monaco-editor', 'Run only monaco editor tests').boolean('only-monaco-editor')
	.describe('browser', 'Run tests in a browser').boolean('browser')
	.alias('h', 'help').boolean('h')
	.describe('h', 'Show help');

var argv = optimist.argv;

if (argv.help) {
	optimist.showHelp();
	process.exit(1);
}

var out = argv.build ? 'out-build' : 'out';
var loader = require('../' + out + '/vs/loader');
var src = path.join(path.dirname(__dirname), out);

function main() {
	process.on('uncaughtException', function (e) {
		console.error(e.stack || e);
	});

	// {{SQL CARBON EDIT}}
	var loaderConfig = {
		nodeRequire: require,
		nodeMain: __filename,
		baseUrl: path.join(path.dirname(__dirname), 'src'),
		paths: {
			'vs/css': '../test/css.mock',
			'vs': `../${out}/vs`,
			'sqltest': `../${out}/sqltest`,
			'sql': `../${out}/sql`,
			'lib': `../${out}/lib`,
			'bootstrap-fork': `../${out}/bootstrap-fork`
		},
		catchError: true,
		// {{SQL CARBON EDIT}}
		nodeModules: [
			'@angular/common',
			'@angular/core',
			'@angular/forms',
			'@angular/platform-browser',
			'@angular/platform-browser-dynamic',
			'@angular/router',
			'angular2-grid',
			'ng2-charts',
			'rxjs/add/observable/of',
			'rxjs/Observable',
			'rxjs/Subject',
			'rxjs/Observer'
		]
	};

	if (argv.coverage) {
		coverage.initialize(loaderConfig);

		process.on('exit', function (code) {
			if (code !== 0) {
				return;
			}
			coverage.createReport(argv.run || argv.runGlob);
		});
	}

	loader.config(loaderConfig);

	global.define = loader;
	global.document = jsdom.jsdom('<!doctype html><html><body></body></html>');
	global.self = global.window = global.document.parentWindow;

	global.Element = global.window.Element;
	global.HTMLElement = global.window.HTMLElement;
	global.Node = global.window.Node;
	global.navigator = global.window.navigator;
	global.XMLHttpRequest = global.window.XMLHttpRequest;
	// {{SQL CARBON EDIT}}
	global.Event = global.window.Event;

	require('reflect-metadata');
	global.window.Reflect = global.Reflect;
	global.window.Zone = global.Zone;

	var didErr = false;
	var write = process.stderr.write;
	process.stderr.write = function (data) {
		didErr = didErr || !!data;
		write.apply(process.stderr, arguments);
	};

	var loadFunc = null;

	if (argv.runGlob) {
		loadFunc = cb => {
			const doRun = tests => {
				const modulesToLoad = tests.map(test => {
					if (path.isAbsolute(test)) {
						test = path.relative(src, path.resolve(test));
					}

					return test.replace(/(\.js)|(\.d\.ts)|(\.js\.map)$/, '');
				});
				define(modulesToLoad, () => cb(null), cb);
			};

			glob(argv.runGlob, { cwd: src }, function (err, files) { doRun(files); });
		};
	} else if (argv.run) {
		var tests = (typeof argv.run === 'string') ? [argv.run] : argv.run;
		var modulesToLoad = tests.map(function (test) {
			test = test.replace(/^src/, 'out');
			test = test.replace(/\.ts$/, '.js');
			return path.relative(src, path.resolve(test)).replace(/(\.js)|(\.js\.map)$/, '').replace(/\\/g, '/');
		});
		loadFunc = cb => {
			define(modulesToLoad, () => cb(null), cb);
		};
	} else if (argv['only-monaco-editor']) {
		loadFunc = function (cb) {
			glob(TEST_GLOB, { cwd: src }, function (err, files) {
				var modulesToLoad = files.map(function (file) {
					return file.replace(/\.js$/, '');
				});
				modulesToLoad = modulesToLoad.filter(function (module) {
					if (/^vs\/workbench\//.test(module)) {
						return false;
					}
					// platform tests drag in the workbench.
					// see https://github.com/Microsoft/vscode/commit/12eaba2f64c69247de105c3d9c47308ac6e44bc9
					// and cry a little
					if (/^vs\/platform\//.test(module)) {
						return false;
					}
					return !/(\/|\\)node(\/|\\)/.test(module);
				});
				console.log(JSON.stringify(modulesToLoad, null, '\t'));
				define(modulesToLoad, function () { cb(null); }, cb);
			});
		};
	} else {
		loadFunc = function (cb) {
			glob(TEST_GLOB, { cwd: src }, function (err, files) {
				var modulesToLoad = files.map(function (file) {
					return file.replace(/\.js$/, '');
				});
				define(modulesToLoad, function () { cb(null); }, cb);
			});
		};
	}

	loadFunc(function (err) {
		if (err) {
			console.error(err);
			return process.exit(1);
		}

		process.stderr.write = write;

		if (!argv.run && !argv.runGlob) {
			// set up last test
			suite('Loader', function () {
				test('should not explode while loading', function () {
					assert.ok(!didErr, 'should not explode while loading');
				});
			});
		}

		// {{SQL CARBON EDIT}}
		/*
		// report failing test for every unexpected error during any of the tests
		var unexpectedErrors = [];
		suite('Errors', function () {
			test('should not have unexpected errors in tests', function () {
				if (unexpectedErrors.length) {
					unexpectedErrors.forEach(function (stack) {
						console.error('');
						console.error(stack);
					});

					assert.ok(false);
				}
			});
		});
	// {{SQL CARBON EDIT}}
		*/

		// replace the default unexpected error handler to be useful during tests
		loader(['vs/base/common/errors'], function (errors) {
			errors.setUnexpectedErrorHandler(function (err) {
				let stack = (err && err.stack) || (new Error().stack);
				// {{SQL CARBON EDIT}}
				//unexpectedErrors.push((err && err.message ? err.message : err) + '\n' + stack);
			});

			// fire up mocha
			run();
		});
	});
}

if (process.argv.some(function (a) { return /^--browser/.test(a); })) {
	require('./browser');
} else {
	main();
}
