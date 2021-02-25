/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const filter = require('gulp-filter');
const es = require('event-stream');
const VinylFile = require('vinyl');
const vfs = require('vinyl-fs');
const path = require('path');
const fs = require('fs');
const pall = require('p-all');
const { all, copyrightFilter, indentationFilter, jsHygieneFilter, tsHygieneFilter } = require('./filters');

	'!build/actions/**/*.js', // {{ SQL CARBON EDIT }}
	'!build/**/*' // {{SQL CARBON EDIT}}
	// {{SQL CARBON EDIT}}
	'!**/*.gif',
	'!build/actions/**/*.js',
	'!**/*.{xlf,lcl,docx,sql,vsix,bacpac,ipynb,jpg}',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/admin-tool-ext-win/ssmsmin/**',
	'!extensions/resource-deployment/notebooks/**',
	'!extensions/mssql/notebooks/**',
	'!extensions/azurehybridtoolkit/notebooks/**',
	'!extensions/integration-tests/testData/**',
	'!extensions/arc/src/controller/generated/**',
	'!extensions/sql-database-projects/resources/templates/*.xml',
	'!extensions/sql-database-projects/src/test/baselines/*.xml',
	'!extensions/sql-database-projects/src/test/baselines/*.json',
	'!extensions/sql-database-projects/src/test/baselines/*.sqlproj',
	'!extensions/sql-database-projects/BuildDirectory/SystemDacpacs/**',
	'!extensions/big-data-cluster/src/bigDataCluster/controller/apiGenerated.ts',
	'!extensions/big-data-cluster/src/bigDataCluster/controller/clusterApiGenerated2.ts',
	'!resources/linux/snap/electron-launch',
	'!resources/xlf/LocProject.json', // {{SQL CARBON EDIT}}
	'!build/**/*' // {{SQL CARBON EDIT}}
	'!scripts/code-web.js',
	'!resources/serverless/code-web.js',
	'!src/vs/editor/test/node/classification/typescript-test.ts',
	// {{SQL CARBON EDIT}}
	'!extensions/notebook/src/intellisense/text.ts',
	'!extensions/mssql/src/hdfs/webhdfs.ts',
	'!src/sql/workbench/contrib/notebook/browser/outputs/tableRenderers.ts',
	'!src/sql/workbench/contrib/notebook/common/models/url.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/renderMimeInterfaces.ts',
	'!src/sql/workbench/contrib/notebook/browser/models/outputProcessor.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/mimemodel.ts',
	'!src/sql/workbench/contrib/notebook/browser/cellViews/media/*.css',
	'!src/sql/base/browser/ui/table/plugins/rowSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/rowDetailView.ts',
	'!src/sql/base/browser/ui/table/plugins/headerFilter.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/checkboxSelectColumn.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/cellSelectionModel.plugin.ts',
	'!src/sql/base/browser/ui/table/plugins/autoSizeColumns.plugin.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/sanitizer.ts',
	'!src/sql/workbench/contrib/notebook/browser/outputs/renderers.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/registry.ts',
	'!src/sql/workbench/services/notebook/browser/outputs/factories.ts',
	'!src/sql/workbench/services/notebook/common/nbformat.ts',
	'!extensions/markdown-language-features/media/tomorrow.css',
	'!src/sql/workbench/browser/modelComponents/media/highlight.css',
	'!src/sql/workbench/contrib/notebook/electron-browser/cellViews/media/highlight.css',
	'!src/sql/workbench/contrib/notebook/browser/turndownPluginGfm.ts',
	'!extensions/mssql/sqltoolsservice/**',
	'!extensions/import/flatfileimportservice/**',
	'!extensions/notebook/src/prompts/**',
	'!extensions/mssql/src/prompts/**',
	'!extensions/kusto/src/prompts/**',
	'!extensions/notebook/resources/jupyter_config/**',
	'!extensions/azurehybridtoolkit/notebooks/**',
	'!extensions/query-history/images/**',
	'!extensions/sql/build/update-grammar.js',
	'!**/*.gif',
	'!**/*.xlf',
	'!**/*.dacpac',
	'!**/*.bacpac',
	'!**/*.py'
	'!build/**/*' // {{SQL CARBON EDIT}}
	'!extensions/big-data-cluster/src/bigDataCluster/controller/apiGenerated.ts', // {{SQL CARBON EDIT}}
	'!extensions/big-data-cluster/src/bigDataCluster/controller/tokenApiGenerated.ts', // {{SQL CARBON EDIT}}
	'!src/vs/base/common/codicons.ts', // {{SQL CARBON EDIT}}
	'!src/vs/workbench/services/themes/common/textMateScopeMatcher.ts', // {{SQL CARBON EDIT}} skip this because we have no plans on touching this and its not ours
	'!src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts', // {{SQL CARBON EDIT}} skip this because known issue
	'!build/**/*' // {{SQL CARBON EDIT}}
const copyrightHeaderLines = [
	'/*---------------------------------------------------------------------------------------------',
	' *  Copyright (c) Microsoft Corporation. All rights reserved.',
	' *  Licensed under the Source EULA. See License.txt in the project root for license information.',
	' *--------------------------------------------------------------------------------------------*/',
];

function hygiene(some, linting = true) {
	const gulpeslint = require('gulp-eslint');
	const tsfmt = require('typescript-formatter');

	let errorCount = 0;

	const productJson = es.through(function (file) {
		// const product = JSON.parse(file.contents.toString('utf8'));

		// if (product.extensionsGallery) { // {{SQL CARBON EDIT}} @todo we need to research on what the point of this is
		// 	console.error('product.json: Contains "extensionsGallery"');
		// 	errorCount++;
		// }

		this.emit('data', file);
	});

	const indentation = es.through(function (file) {
		const lines = file.contents.toString('utf8').split(/\r\n|\r|\n/);
		file.__lines = lines;

		lines.forEach((line, i) => {
			if (/^\s*$/.test(line)) {
				// empty or whitespace lines are OK
			} else if (/^[\t]*[^\s]/.test(line)) {
				// good indent
			} else if (/^[\t]* \*/.test(line)) {
				// block comment using an extra space
			} else {
				console.error(
					file.relative + '(' + (i + 1) + ',1): Bad whitespace indentation'
				);
				errorCount++;
			}
		});

		this.emit('data', file);
	});

	const copyrights = es.through(function (file) {
		const lines = file.__lines;

		for (let i = 0; i < copyrightHeaderLines.length; i++) {
			if (lines[i] !== copyrightHeaderLines[i]) {
				//console.error(file.relative + ': Missing or bad copyright statement');
				//errorCount++;
				break;
			}
		}

		this.emit('data', file);
	});

	const formatting = es.map(function (file, cb) {
		tsfmt
			.processString(file.path, file.contents.toString('utf8'), {
				verify: false,
				tsfmt: true,
				// verbose: true,
				// keep checkJS happy
				editorconfig: undefined,
				replace: undefined,
				tsconfig: undefined,
				tsconfigFile: undefined,
				tsfmtFile: undefined,
				vscode: undefined,
				vscodeFile: undefined,
			})
			.then(
				(result) => {
					let original = result.src.replace(/\r\n/gm, '\n');
					let formatted = result.dest.replace(/\r\n/gm, '\n');

					if (original !== formatted) {
						console.error(
							`File not formatted. Run the 'Format Document' command to fix it:`,
							file.relative
						);
						errorCount++;
					}
					cb(null, file);
				},
				(err) => {
					cb(err);
				}
			);
	});

	let input;

	if (Array.isArray(some) || typeof some === 'string' || !some) {
		const options = { base: '.', follow: true, allowEmpty: true };
		if (some) {
			input = vfs.src(some, options).pipe(filter(all)); // split this up to not unnecessarily filter all a second time
		} else {
			input = vfs.src(all, options);
		}
	} else {
		input = some;
	}

	const productJsonFilter = filter('product.json', { restore: true });

	const result = input
		.pipe(filter((f) => !f.stat.isDirectory()))
		.pipe(productJsonFilter)
		.pipe(process.env['BUILD_SOURCEVERSION'] ? es.through() : productJson)
		.pipe(productJsonFilter.restore)
		.pipe(filter(indentationFilter))
		.pipe(indentation)
		.pipe(filter(copyrightFilter))
		.pipe(copyrights);

	const streams = [
		result.pipe(filter(tsHygieneFilter)).pipe(formatting)
	];

	if (linting) {
		streams.push(
			result
				.pipe(filter([...jsHygieneFilter, ...tsHygieneFilter]))
				.pipe(
					gulpeslint({
						configFile: '.eslintrc.json',
						rulePaths: ['./build/lib/eslint'],
					})
				)
				.pipe(gulpeslint.formatEach('compact'))
				.pipe(
					gulpeslint.results((results) => {
						errorCount += results.warningCount;
						errorCount += results.errorCount;
					})
				)
		);
	}

	let count = 0;
	return es.merge(...streams).pipe(
		es.through(
			function (data) {
				count++;
				if (process.env['TRAVIS'] && count % 10 === 0) {
					process.stdout.write('.');
				}
				this.emit('data', data);
			},
			function () {
				process.stdout.write('\n');
				if (errorCount > 0) {
					this.emit(
						'error',
						'Hygiene failed with ' +
						errorCount +
						` errors. Check 'build / gulpfile.hygiene.js'.`
					);
				} else {
					this.emit('end');
				}
			}
		)
	);
}

module.exports.hygiene = hygiene;

function createGitIndexVinyls(paths) {
	const cp = require('child_process');
	const repositoryPath = process.cwd();

	const fns = paths.map((relativePath) => () =>
		new Promise((c, e) => {
			const fullPath = path.join(repositoryPath, relativePath);

			fs.stat(fullPath, (err, stat) => {
				if (err && err.code === 'ENOENT') {
					// ignore deletions
					return c(null);
				} else if (err) {
					return e(err);
				}

				cp.exec(
					process.platform === 'win32' ? `git show :${relativePath}` : `git show ':${relativePath}'`,
					{ maxBuffer: 2000 * 1024, encoding: 'buffer' },
					(err, out) => {
						if (err) {
							return e(err);
						}

						c(
							new VinylFile({
								path: fullPath,
								base: repositoryPath,
								contents: out,
								stat,
							})
						);
					}
				);
			});
		})
	);

	return pall(fns, { concurrency: 4 }).then((r) => r.filter((p) => !!p));
}

// this allows us to run hygiene as a git pre-commit hook
if (require.main === module) {
	const cp = require('child_process');

	process.on('unhandledRejection', (reason, p) => {
		console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
		process.exit(1);
	});

	if (process.argv.length > 2) {
		hygiene(process.argv.slice(2)).on('error', (err) => {
			console.error();
			console.error(err);
			process.exit(1);
		});
	} else {
		cp.exec(
			'git diff --cached --name-only',
			{ maxBuffer: 2000 * 1024 },
			(err, out) => {
				if (err) {
					console.error();
					console.error(err);
					process.exit(1);
				}

				const some = out.split(/\r?\n/).filter((l) => !!l);

				if (some.length > 0) {
					console.log('Reading git index versions...');

					createGitIndexVinyls(some)
						.then(
							(vinyls) =>
								new Promise((c, e) =>
									hygiene(es.readArray(vinyls))
										.on('end', () => c())
										.on('error', e)
								)
						)
						.catch((err) => {
							console.error();
							console.error(err);
							process.exit(1);
						});
				}
			}
		);
	}
}
