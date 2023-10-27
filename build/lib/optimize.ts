/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as es from 'event-stream';
import * as gulp from 'gulp';
import * as concat from 'gulp-concat';
import * as filter from 'gulp-filter';
import * as fancyLog from 'fancy-log';
import * as ansiColors from 'ansi-colors';
import * as path from 'path';
import * as pump from 'pump';
import * as VinylFile from 'vinyl';
import * as bundle from './bundle';
import { Language, processNlsFiles } from './i18n';
import { createStatsStream } from './stats';
import * as util from './util';

const REPO_ROOT_PATH = path.join(__dirname, '../..');

function log(prefix: string, message: string): void {
	fancyLog(ansiColors.cyan('[' + prefix + ']'), message);
}

export function loaderConfig() {
	const result: any = {
		paths: {
			'vs': 'out-build/vs',
			'sql': 'out-build/sql', // {{SQL CARBON EDIT}}
			'vscode': 'empty:',
			'azdata': 'empty:' // {{SQL CARBON EDIT}}
		},
		amdModulesPattern: /^(vs|sql)\// // {{SQL CARBON EDIT}} include sql in regex
	};

	result['vs/css'] = { inlineResources: true };

	return result;
}

const IS_OUR_COPYRIGHT_REGEXP = /Copyright \(C\) Microsoft Corporation/i;

function loaderPlugin(src: string, base: string, amdModuleId: string | undefined): NodeJS.ReadWriteStream {
	return (
		gulp
			.src(src, { base })
			.pipe(es.through(function (data: VinylFile) {
				if (amdModuleId) {
					let contents = data.contents.toString('utf8');
					contents = contents.replace(/^define\(/m, `define("${amdModuleId}",`);
					data.contents = Buffer.from(contents);
				}
				this.emit('data', data);
			}))
	);
}

function loader(src: string, bundledFileHeader: string, bundleLoader: boolean, externalLoaderInfo?: util.IExternalLoaderInfo): NodeJS.ReadWriteStream {
	let loaderStream = gulp.src(`${src}/vs/loader.js`, { base: `${src}` });
	if (bundleLoader) {
		loaderStream = es.merge(
			loaderStream,
			loaderPlugin(`${src}/vs/css.js`, `${src}`, 'vs/css'),
			loaderPlugin(`${src}/vs/nls.js`, `${src}`, 'vs/nls'),
		);
	}

	const files: VinylFile[] = [];
	const order = (f: VinylFile) => {
		if (f.path.endsWith('loader.js')) {
			return 0;
		}
		if (f.path.endsWith('css.js')) {
			return 1;
		}
		if (f.path.endsWith('nls.js')) {
			return 2;
		}
		return 3;
	};

	return (
		loaderStream
			.pipe(es.through(function (data) {
				files.push(data);
			}, function () {
				files.sort((a, b) => {
					return order(a) - order(b);
				});
				files.unshift(new VinylFile({
					path: 'fake',
					base: '.',
					contents: Buffer.from(bundledFileHeader)
				}));
				if (externalLoaderInfo !== undefined) {
					files.push(new VinylFile({
						path: 'fake2',
						base: '.',
						contents: Buffer.from(emitExternalLoaderInfo(externalLoaderInfo))
					}));
				}
				for (const file of files) {
					this.emit('data', file);
				}
				this.emit('end');
			}))
			.pipe(concat('vs/loader.js'))
	);
}

function emitExternalLoaderInfo(externalLoaderInfo: util.IExternalLoaderInfo): string {
	const externalBaseUrl = externalLoaderInfo.baseUrl;
	externalLoaderInfo.baseUrl = '$BASE_URL';

	// If defined, use the runtime configured baseUrl.
	const code = `
(function() {
	const baseUrl = require.getConfig().baseUrl || ${JSON.stringify(externalBaseUrl)};
	require.config(${JSON.stringify(externalLoaderInfo, undefined, 2)});
})();`;
	return code.replace('"$BASE_URL"', 'baseUrl');
}

function toConcatStream(src: string, bundledFileHeader: string, sources: bundle.IFile[], dest: string, fileContentMapper: (contents: string, path: string) => string): NodeJS.ReadWriteStream {
	const useSourcemaps = /\.js$/.test(dest) && !/\.nls\.js$/.test(dest);

	// If a bundle ends up including in any of the sources our copyright, then
	// insert a fake source at the beginning of each bundle with our copyright
	let containsOurCopyright = false;
	for (let i = 0, len = sources.length; i < len; i++) {
		const fileContents = sources[i].contents;
		if (IS_OUR_COPYRIGHT_REGEXP.test(fileContents)) {
			containsOurCopyright = true;
			break;
		}
	}

	if (containsOurCopyright) {
		sources.unshift({
			path: null,
			contents: bundledFileHeader
		});
	}

	const treatedSources = sources.map(function (source) {
		const root = source.path ? REPO_ROOT_PATH.replace(/\\/g, '/') : '';
		const base = source.path ? root + `/${src}` : '.';
		const path = source.path ? root + '/' + source.path.replace(/\\/g, '/') : 'fake';
		const contents = source.path ? fileContentMapper(source.contents, path) : source.contents;

		return new VinylFile({
			path: path,
			base: base,
			contents: Buffer.from(contents)
		});
	});

	return es.readArray(treatedSources)
		.pipe(useSourcemaps ? util.loadSourcemaps() : es.through())
		.pipe(concat(dest))
		.pipe(createStatsStream(dest));
}

function toBundleStream(src: string, bundledFileHeader: string, bundles: bundle.IConcatFile[], fileContentMapper: (contents: string, path: string) => string): NodeJS.ReadWriteStream {
	return es.merge(bundles.map(function (bundle) {
		return toConcatStream(src, bundledFileHeader, bundle.sources, bundle.dest, fileContentMapper);
	}));
}

export interface IOptimizeAMDTaskOpts {
	/**
	 * The folder to read files from.
	 */
	src: string;
	/**
	 * (for AMD files, will get bundled and get Copyright treatment)
	 */
	entryPoints: bundle.IEntryPoint[];
	/**
	 * (svg, etc.)
	 */
	resources: string[];
	loaderConfig: any;
	/**
	 * Additional info we append to the end of the loader
	 */
	externalLoaderInfo?: util.IExternalLoaderInfo;
	/**
	 * (true by default - append css and nls to loader)
	 */
	bundleLoader?: boolean;
	/**
	 * (basically the Copyright treatment)
	 */
	header?: string;
	/**
	 * (emit bundleInfo.json file)
	 */
	bundleInfo: boolean;
	/**
	 * Language configuration.
	 */
	languages?: Language[];
	/**
	 * File contents interceptor
	 * @param contents The contents of the file
	 * @param path The absolute file path, always using `/`, even on Windows
	 */
	fileContentMapper?: (contents: string, path: string) => string;
}

const DEFAULT_FILE_HEADER = [
	'/*!--------------------------------------------------------',
	' * Copyright (C) Microsoft Corporation. All rights reserved.',
	' *--------------------------------------------------------*/'
].join('\n');

function optimizeAMDTask(opts: IOptimizeAMDTaskOpts): NodeJS.ReadWriteStream {
	const src = opts.src;
	const entryPoints = opts.entryPoints;
	const resources = opts.resources;
	const loaderConfig = opts.loaderConfig;
	const bundledFileHeader = opts.header || DEFAULT_FILE_HEADER;
	const fileContentMapper = opts.fileContentMapper || ((contents: string, _path: string) => contents);

	const sourcemaps = require('gulp-sourcemaps') as typeof import('gulp-sourcemaps');

	const bundlesStream = es.through(); // this stream will contain the bundled files
	const resourcesStream = es.through(); // this stream will contain the resources
	const bundleInfoStream = es.through(); // this stream will contain bundleInfo.json

	bundle.bundle(entryPoints, loaderConfig, function (err, result) {
		if (err || !result) { return bundlesStream.emit('error', JSON.stringify(err)); }

		toBundleStream(src, bundledFileHeader, result.files, fileContentMapper).pipe(bundlesStream);

		// Remove css inlined resources
		const filteredResources = resources.slice();
		result.cssInlinedResources.forEach(function (resource) {
			if (process.env['VSCODE_BUILD_VERBOSE']) {
				log('optimizer', 'excluding inlined: ' + resource);
			}
			filteredResources.push('!' + resource);
		});
		gulp.src(filteredResources, { base: `${src}`, allowEmpty: true }).pipe(resourcesStream);

		const bundleInfoArray: VinylFile[] = [];
		if (opts.bundleInfo) {
			bundleInfoArray.push(new VinylFile({
				path: 'bundleInfo.json',
				base: '.',
				contents: Buffer.from(JSON.stringify(result.bundleData, null, '\t'))
			}));
		}
		es.readArray(bundleInfoArray).pipe(bundleInfoStream);
	});

	const result = es.merge(
		loader(src, bundledFileHeader, false, opts.externalLoaderInfo),
		bundlesStream,
		resourcesStream,
		bundleInfoStream
	);

	return result
		.pipe(sourcemaps.write('./', {
			sourceRoot: undefined,
			addComment: true,
			includeContent: true
		}))
		.pipe(opts.languages && opts.languages.length ? processNlsFiles({
			fileHeader: bundledFileHeader,
			languages: opts.languages
		}) : es.through());
}

export interface IOptimizeCommonJSTaskOpts {
	/**
	 * The paths to consider for optimizing.
	 */
	entryPoints: string[];
	/**
	 * The folder to read files from.
	 */
	src: string;
	/**
	 * ESBuild `platform` option: https://esbuild.github.io/api/#platform
	 */
	platform: 'browser' | 'node' | 'neutral';
	/**
	 * ESBuild `external` option: https://esbuild.github.io/api/#external
	 */
	external: string[];
}

function optimizeCommonJSTask(opts: IOptimizeCommonJSTaskOpts): NodeJS.ReadWriteStream {
	const esbuild = require('esbuild') as typeof import('esbuild');

	const src = opts.src;
	const entryPoints = opts.entryPoints;

	return gulp.src(entryPoints, { base: `${src}`, allowEmpty: true })
		.pipe(es.map((f: any, cb) => {
			esbuild.build({
				entryPoints: [f.path],
				bundle: true,
				platform: opts.platform,
				write: false,
				external: opts.external
			}).then(res => {
				const jsFile = res.outputFiles[0];
				f.contents = Buffer.from(jsFile.contents);

				cb(undefined, f);
			});
		}));
}

export interface IOptimizeManualTaskOpts {
	/**
	 * The paths to consider for concatenation. The entries
	 * will be concatenated in the order they are provided.
	 */
	src: string[];
	/**
	 * Destination target to concatenate the entryPoints into.
	 */
	out: string;
}

function optimizeManualTask(options: IOptimizeManualTaskOpts[]): NodeJS.ReadWriteStream {
	const concatenations = options.map(opt => {
		return gulp
			.src(opt.src)
			.pipe(concat(opt.out));
	});

	return es.merge(...concatenations);
}

export function optimizeLoaderTask(src: string, out: string, bundleLoader: boolean, bundledFileHeader = '', externalLoaderInfo?: util.IExternalLoaderInfo): () => NodeJS.ReadWriteStream {
	return () => loader(src, bundledFileHeader, bundleLoader, externalLoaderInfo).pipe(gulp.dest(out));
}

export interface IOptimizeTaskOpts {
	/**
	 * Destination folder for the optimized files.
	 */
	out: string;
	/**
	 * Optimize AMD modules (using our AMD loader).
	 */
	amd: IOptimizeAMDTaskOpts;
	/**
	 * Optimize CommonJS modules (using esbuild).
	 */
	commonJS?: IOptimizeCommonJSTaskOpts;
	/**
	 * Optimize manually by concatenating files.
	 */
	manual?: IOptimizeManualTaskOpts[];
}

export function optimizeTask(opts: IOptimizeTaskOpts): () => NodeJS.ReadWriteStream {
	return function () {
		const optimizers = [optimizeAMDTask(opts.amd)];
		if (opts.commonJS) {
			optimizers.push(optimizeCommonJSTask(opts.commonJS));
		}

		if (opts.manual) {
			optimizers.push(optimizeManualTask(opts.manual));
		}

		return es.merge(...optimizers).pipe(gulp.dest(opts.out));
	};
}

export function minifyTask(src: string, sourceMapBaseUrl?: string): (cb: any) => void {
	const esbuild = require('esbuild') as typeof import('esbuild');
	const sourceMappingURL = sourceMapBaseUrl ? ((f: any) => `${sourceMapBaseUrl}/${f.relative}.map`) : undefined;

	return cb => {
		const cssnano = require('cssnano') as typeof import('cssnano');
		const postcss = require('gulp-postcss') as typeof import('gulp-postcss');
		const sourcemaps = require('gulp-sourcemaps') as typeof import('gulp-sourcemaps');
		const svgmin = require('gulp-svgmin') as typeof import('gulp-svgmin');

		const jsFilter = filter('**/*.js', { restore: true });
		const cssFilter = filter('**/*.css', { restore: true });
		const svgFilter = filter('**/*.svg', { restore: true });

		pump(
			gulp.src([src + '/**', '!' + src + '/**/*.map']),
			jsFilter,
			sourcemaps.init({ loadMaps: true }),
			es.map((f: any, cb) => {
				esbuild.build({
					entryPoints: [f.path],
					minify: true,
					sourcemap: 'external',
					outdir: '.',
					platform: 'node',
					target: ['esnext'],
					write: false
				}).then(res => {
					const jsFile = res.outputFiles.find(f => /\.js$/.test(f.path))!;
					const sourceMapFile = res.outputFiles.find(f => /\.js\.map$/.test(f.path))!;

					const contents = Buffer.from(jsFile.contents);
					const unicodeMatch = contents.toString().match(/[^\x00-\xFF]+/g);
					if (unicodeMatch) {
						cb(new Error(`Found non-ascii character ${unicodeMatch[0]} in the minified output of ${f.path}. Non-ASCII characters in the output can cause performance problems when loading. Please review if you have introduced a regular expression that esbuild is not automatically converting and convert it to using unicode escape sequences.`));
					} else {
						f.contents = contents;
						f.sourceMap = JSON.parse(sourceMapFile.text);

						cb(undefined, f);
					}
				}, cb);
			}),
			jsFilter.restore,
			cssFilter,
			postcss([cssnano({ preset: 'default' })]),
			cssFilter.restore,
			svgFilter,
			// {{SQL CARBON EDIT}} - Disable the removeViewBox option because some SVG files ADS needs will not scale properly when the view box information is removed.
			svgmin({
				plugins: [
					{ removeViewBox: false }
				]
			}),
			svgFilter.restore,
			(<any>sourcemaps).mapSources((sourcePath: string) => {
				if (sourcePath === 'bootstrap-fork.js') {
					return 'bootstrap-fork.orig.js';
				}

				return sourcePath;
			}),
			sourcemaps.write('./', {
				sourceMappingURL,
				sourceRoot: undefined,
				includeContent: true,
				addComment: true
			} as any),
			gulp.dest(src + '-min'),
			(err: any) => cb(err));
	};
}
