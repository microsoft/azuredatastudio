/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const gulp = require('gulp');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');
const path = require('path');
const es = require('event-stream');
const vfs = require('vinyl-fs');
const rename = require('gulp-rename');
const replace = require('gulp-replace');
const filter = require('gulp-filter');
const _ = require('underscore');
const util = require('./lib/util');
const task = require('./lib/task');
const buildfile = require('../src/buildfile');
const common = require('./lib/optimize');
const root = path.dirname(__dirname);
const commit = util.getVersion(root);
const packageJson = require('../package.json');
const product = require('../product.json');
const crypto = require('crypto');
const i18n = require('./lib/i18n');
const { getProductionDependencies } = require('./lib/dependencies');
const { config } = require('./lib/electron');
const createAsar = require('./lib/asar').createAsar;
const { compileBuildTask } = require('./gulpfile.compile');
const { compileExtensionsBuildTask, compileLocalizationExtensionsBuildTask } = require('./gulpfile.extensions');  // {{SQL CARBON EDIT}} Must handle localization code.

// Build
const vscodeEntryPoints = _.flatten([
	buildfile.entrypoint('vs/workbench/workbench.desktop.main'),
	buildfile.base,
	buildfile.workerExtensionHost,
	buildfile.workerNotebook,
	buildfile.workbenchDesktop,
	buildfile.code
]);

const vscodeResources = [
	'out-build/main.js',
	'out-build/cli.js',
	'out-build/driver.js',
	'out-build/bootstrap.js',
	'out-build/bootstrap-fork.js',
	'out-build/bootstrap-amd.js',
	'out-build/bootstrap-node.js',
	'out-build/bootstrap-window.js',
	'out-build/vs/**/*.{svg,png,html,jpg}',
	'!out-build/vs/code/browser/**/*.html',
	'!out-build/vs/editor/standalone/**/*.svg',
	'out-build/vs/base/common/performance.js',
	'out-build/vs/base/node/languagePacks.js',
	'out-build/vs/base/node/{stdForkStart.js,terminateProcess.sh,cpuUsage.sh,ps.sh}',
	'out-build/vs/base/browser/ui/codicons/codicon/**',
	'out-build/vs/base/parts/sandbox/electron-browser/preload.js',
	'out-build/vs/platform/environment/node/userDataPath.js',
	'out-build/vs/workbench/browser/media/*-theme.css',
	'out-build/vs/workbench/contrib/debug/**/*.json',
	'out-build/vs/workbench/contrib/externalTerminal/**/*.scpt',
	'out-build/vs/workbench/contrib/webview/browser/pre/*.js',
	'out-build/vs/workbench/contrib/webview/electron-browser/pre/*.js',
	'out-build/vs/workbench/services/extensions/worker/extensionHostWorkerMain.js',
	'out-build/vs/**/markdown.css',
	'out-build/vs/workbench/contrib/tasks/**/*.json',
	'out-build/vs/platform/files/**/*.exe',
	'out-build/vs/platform/files/**/*.md',
	'out-build/vs/code/electron-browser/workbench/**',
	'out-build/vs/code/electron-browser/sharedProcess/sharedProcess.js',
	'out-build/vs/code/electron-sandbox/issue/issueReporter.js',
	'out-build/sql/**/*.{svg,png,cur,html}',
	'out-build/sql/base/browser/ui/table/media/*.{gif,png,svg}',
	'out-build/sql/base/browser/ui/checkbox/media/*.{gif,png,svg}',
	'out-build/sql/parts/admin/**/*.html',
	'out-build/sql/parts/connection/connectionDialog/media/*.{gif,png,svg}',
	'out-build/sql/parts/common/dblist/**/*.html',
	'out-build/sql/workbench/parts/dashboard/**/*.html',
	'out-build/sql/parts/disasterRecovery/**/*.html',
	'out-build/sql/parts/common/modal/media/**',
	'out-build/sql/workbench/parts/grid/media/**',
	'out-build/sql/workbench/parts/grid/views/**/*.html',
	'out-build/sql/parts/tasks/**/*.html',
	'out-build/sql/parts/taskHistory/viewlet/media/**',
	'out-build/sql/parts/jobManagement/common/media/*.svg',
	'out-build/sql/media/objectTypes/*.svg',
	'out-build/sql/media/icons/*.svg',
	'out-build/sql/workbench/parts/notebook/media/**/*.svg',
	'out-build/sql/setup.js', // {{SQL CARBON EDIT}} end
	'out-build/vs/code/electron-sandbox/processExplorer/processExplorer.js',
	'!**/test/**'
];

const optimizeVSCodeTask = task.define('optimize-vscode', task.series(
	util.rimraf('out-vscode'),
	common.optimizeTask({
		src: 'out-build',
		entryPoints: vscodeEntryPoints,
		resources: vscodeResources,
		loaderConfig: common.loaderConfig(),
		out: 'out-vscode',
		bundleInfo: undefined
	})
));
gulp.task(optimizeVSCodeTask);

// {{SQL CARBON EDIT}} Gulp task that imports any relevant ADS XLF found in vscode-translations-export to resources/xlf/en folder.

// List of ADS extension XLF files that we want to put into the English resource folder.
const extensionsFilter = filter([
	'**/admin-tool-ext-win.xlf',
	'**/agent.xlf',
	'**/arc.xlf',
	'**/asde-deployment.xlf',
	'**/azdata.xlf',
	'**/azurecore.xlf',
	'**/azurehybridtoolkit.xlf',
	'**/big-data-cluster.xlf',
	'**/cms.xlf',
	'**/dacpac.xlf',
	'**/data-workspace.xlf',
	'**/import.xlf',
	'**/kusto.xlf',
	'**/machine-learning.xlf',
	'**/Microsoft.sqlservernotebook.xlf',
	'**/mssql.xlf',
	'**/notebook.xlf',
	'**/profiler.xlf',
	'**/query-history.xlf',
	'**/resource-deployment.xlf',
	'**/schema-compare.xlf',
	'**/server-report.xlf',
	'**/sql-assessment.xlf',
	'**/sql-database-projects.xlf',
	'**/sql-migration.xlf',
	'**/xml-language-features.xlf'
]);

// Copy ADS extension XLFs into English resource folder.
const importExtensionsTask = task.define('import-extensions-xlfs', function () {
	return es.merge(
		gulp.src(`./vscode-translations-export/vscode-extensions/*.xlf`)
			.pipe(extensionsFilter),
		gulp.src(`./vscode-translations-export/ads-core/*.xlf`)
	)
	.pipe(vfs.dest(`./resources/xlf/en`));
});
gulp.task(importExtensionsTask);
// {{SQL CARBON EDIT}} end

const sourceMappingURLBase = `https://sqlopsbuilds.blob.core.windows.net/sourcemaps/${commit}`;
const minifyVSCodeTask = task.define('minify-vscode', task.series(
	optimizeVSCodeTask,
	util.rimraf('out-vscode-min'),
	common.minifyTask('out-vscode', `${sourceMappingURLBase}/core`)
));
gulp.task(minifyVSCodeTask);

const core = task.define('core-ci', task.series(
	gulp.task('compile-build'),
	task.parallel(
		gulp.task('minify-vscode'),
		gulp.task('minify-vscode-reh'),
		gulp.task('minify-vscode-reh-web'),
	)
));
gulp.task(core);

/**
 * Compute checksums for some files.
 *
 * @param {string} out The out folder to read the file from.
 * @param {string[]} filenames The paths to compute a checksum for.
 * @return {Object} A map of paths to checksums.
 */
function computeChecksums(out, filenames) {
	let result = {};
	filenames.forEach(function (filename) {
		let fullPath = path.join(process.cwd(), out, filename);
		result[filename] = computeChecksum(fullPath);
	});
	return result;
}

/**
 * Compute checksum for a file.
 *
 * @param {string} filename The absolute path to a filename.
 * @return {string} The checksum for `filename`.
 */
function computeChecksum(filename) {
	let contents = fs.readFileSync(filename);

	let hash = crypto
		.createHash('md5')
		.update(contents)
		.digest('base64')
		.replace(/=+$/, '');

	return hash;
}

function packageTask(platform, arch, sourceFolderName, destinationFolderName, opts) {
	opts = opts || {};

	const destination = path.join(path.dirname(root), destinationFolderName);
	platform = platform || process.platform;

	return () => {
		const electron = require('gulp-atom-electron');
		const json = require('gulp-json-editor');

		const out = sourceFolderName;

		const checksums = computeChecksums(out, [
			'vs/base/parts/sandbox/electron-browser/preload.js',
			'vs/workbench/workbench.desktop.main.js',
			'vs/workbench/workbench.desktop.main.css',
			'vs/workbench/services/extensions/node/extensionHostProcess.js',
			'vs/code/electron-browser/workbench/workbench.html',
			'vs/code/electron-browser/workbench/workbench.js'
		]);

		const src = gulp.src(out + '/**', { base: '.' })
			.pipe(rename(function (path) { path.dirname = path.dirname.replace(new RegExp('^' + out), 'out'); }))
			.pipe(util.setExecutableBit(['**/*.sh']));

		const extensions = gulp.src(['.build/extensions/**', '!.build/extensions/node_modules/**'], { base: '.build', dot: true }); // {{SQL CARBON EDIT}} - don't package the node_modules directory

		const sources = es.merge(src, extensions)
			.pipe(filter(['**', '!**/*.js.map'], { dot: true }));

		let version = packageJson.version;
		const quality = product.quality;

		if (quality && quality !== 'stable') {
			version += '-' + quality;
		}

		// {{SQL CARBON EDIT}}
		const name = (platform === 'darwin') ? 'Azure Data Studio' : product.nameShort;
		const packageJsonUpdates = { name, version };

		// for linux url handling
		if (platform === 'linux') {
			packageJsonUpdates.desktopName = `${product.applicationName}-url-handler.desktop`;
		}

		const packageJsonStream = gulp.src(['package.json'], { base: '.' })
			.pipe(json(packageJsonUpdates));

		const date = new Date().toISOString();
		const productJsonUpdate = { commit, date, checksums };

		if (shouldSetupSettingsSearch()) {
			productJsonUpdate.settingsSearchBuildId = getSettingsSearchBuildId(packageJson);
		}

		const productJsonStream = gulp.src(['product.json'], { base: '.' })
			.pipe(json(productJsonUpdate));

		const license = gulp.src(['LICENSES.chromium.html', product.licenseFileName, 'ThirdPartyNotices.txt', 'licenses/**'], { base: '.', allowEmpty: true });

		// TODO the API should be copied to `out` during compile, not here
		const api = gulp.src('src/vs/vscode.d.ts').pipe(rename('out/vs/vscode.d.ts'));
		// {{SQL CARBON EDIT}}
		const dataApi = gulp.src('src/sql/azdata.d.ts').pipe(rename('out/sql/azdata.d.ts'));

		const telemetry = gulp.src('.build/telemetry/**', { base: '.build/telemetry', dot: true });

		const jsFilter = util.filter(data => !data.isDirectory() && /\.js$/.test(data.path));
		const root = path.resolve(path.join(__dirname, '..'));
		const productionDependencies = getProductionDependencies(root);
		const dependenciesSrc = _.flatten(productionDependencies.map(d => path.relative(root, d.path)).map(d => [`${d}/**`, `!${d}/**/{test,tests}/**`]));

		const deps = gulp.src(dependenciesSrc, { base: '.', dot: true })
			.pipe(filter(['**', `!**/${config.version}/**`, '!**/bin/darwin-arm64-87/**', '!**/package-lock.json', '!**/yarn.lock', '!**/*.js.map']))
			.pipe(util.cleanNodeModules(path.join(__dirname, '.moduleignore')))
			.pipe(jsFilter)
			.pipe(util.rewriteSourceMappingURL(sourceMappingURLBase))
			.pipe(jsFilter.restore)
			.pipe(createAsar(path.join(process.cwd(), 'node_modules'), ['**/*.node', '**/vscode-ripgrep/bin/*', '**/node-pty/build/Release/*', '**/*.wasm'], 'node_modules.asar'));

		let all = es.merge(
			packageJsonStream,
			productJsonStream,
			license,
			api,
			dataApi, // {{SQL CARBON EDIT}}
			telemetry,
			sources,
			deps
		);

		if (platform === 'win32') {
			all = es.merge(all, gulp.src([
				// {{SQL CARBON EDIT}} remove unused icons
				'resources/win32/code_70x70.png',
				'resources/win32/code_150x150.png'
			], { base: '.' }));
		} else if (platform === 'linux') {
			all = es.merge(all, gulp.src('resources/linux/code.png', { base: '.' }));
		} else if (platform === 'darwin') {
			const shortcut = gulp.src('resources/darwin/bin/code.sh')
				.pipe(rename('bin/code'));

			all = es.merge(all, shortcut);
		}

		let result = all
			.pipe(fileLengthFilter)
			.pipe(filelength)
			.pipe(fileLengthFilter.restore)
			.pipe(util.skipDirectories())
			.pipe(util.fixWin32DirectoryPermissions())
			.pipe(filter(['**', '!**/.github/**'], { dot: true })) // https://github.com/microsoft/vscode/issues/116523
			.pipe(electron(_.extend({}, config, { platform, arch: arch === 'armhf' ? 'arm' : arch, ffmpegChromium: true })))
			.pipe(filter(['**', '!LICENSE', '!LICENSES.chromium.html', '!version'], { dot: true }));

		if (platform === 'linux') {
			result = es.merge(result, gulp.src('resources/completions/bash/code', { base: '.' })
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename(function (f) { f.basename = product.applicationName; })));

			result = es.merge(result, gulp.src('resources/completions/zsh/_code', { base: '.' })
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(rename(function (f) { f.basename = '_' + product.applicationName; })));
		}

		if (platform === 'win32') {
			result = es.merge(result, gulp.src('resources/win32/bin/code.js', { base: 'resources/win32', allowEmpty: true }));

			result = es.merge(result, gulp.src('resources/win32/bin/code.cmd', { base: 'resources/win32' })
				.pipe(replace('@@NAME@@', product.nameShort))
				.pipe(rename(function (f) { f.basename = product.applicationName; })));

			result = es.merge(result, gulp.src('resources/win32/bin/code.sh', { base: 'resources/win32' })
				.pipe(replace('@@NAME@@', product.nameShort))
				.pipe(replace('@@PRODNAME@@', product.nameLong))
				.pipe(replace('@@VERSION@@', version))
				.pipe(replace('@@COMMIT@@', commit))
				.pipe(replace('@@APPNAME@@', product.applicationName))
				.pipe(replace('@@DATAFOLDER@@', product.dataFolderName))
				.pipe(replace('@@QUALITY@@', quality))
				.pipe(rename(function (f) { f.basename = product.applicationName; f.extname = ''; })));

			result = es.merge(result, gulp.src('resources/win32/VisualElementsManifest.xml', { base: 'resources/win32' })
				.pipe(rename(product.nameShort + '.VisualElementsManifest.xml')));
		} else if (platform === 'linux') {
			result = es.merge(result, gulp.src('resources/linux/bin/code.sh', { base: '.' })
				.pipe(replace('@@PRODNAME@@', product.nameLong))
				.pipe(replace('@@NAME@@', product.applicationName))
				.pipe(rename('bin/' + product.applicationName)));
		}

		// submit all stats that have been collected
		// during the build phase
		if (opts.stats) {
			result.on('end', () => {
				const { submitAllStats } = require('./lib/stats');
				submitAllStats(product, commit).then(() => console.log('Submitted bundle stats!'));
			});
		}

		return result.pipe(vfs.dest(destination));
	};
}

const fileLengthFilter = filter([
	'**',
	'!extensions/import/*.docx',
	'!extensions/admin-tool-ext-win/license/**'
], {restore: true});

const filelength = es.through(function (file) {

	const fileName = path.basename(file.relative);
	const fileDir = path.dirname(file.relative);
	//check the filename is < 50 characters (basename gets the filename with extension).
	if (fileName.length > 50) {
		console.error(`File name '${fileName}' under ${fileDir} is too long. Rename file to have less than 50 characters.`);
		throw new Error('File name exceeds acceptable length of 50 characters: ' + fileName);
	}
	if (file.relative.length > 150) {
		console.error(`File path ${file.relative} exceeds acceptable file-length. Rename the path to have less than 150 characters.`);
		throw new Error('File path exceeds acceptable path-length of 150 characters: ' + file.relative);
	}

	this.emit('data', file);
});

const buildRoot = path.dirname(root);

const BUILD_TARGETS = [
	{ platform: 'win32', arch: 'ia32' },
	{ platform: 'win32', arch: 'x64' },
	{ platform: 'win32', arch: 'arm64' },
	{ platform: 'darwin', arch: 'x64', opts: { stats: true } },
	{ platform: 'darwin', arch: 'arm64', opts: { stats: true } },
	{ platform: 'linux', arch: 'ia32' },
	{ platform: 'linux', arch: 'x64' },
	{ platform: 'linux', arch: 'armhf' },
	{ platform: 'linux', arch: 'arm64' },
];
BUILD_TARGETS.forEach(buildTarget => {
	const dashed = (str) => (str ? `-${str}` : ``);
	const platform = buildTarget.platform;
	const arch = buildTarget.arch;
	const opts = buildTarget.opts;

	const [vscode, vscodeMin] = ['', 'min'].map(minified => {
		const sourceFolderName = `out-vscode${dashed(minified)}`;
		const destinationFolderName = `azuredatastudio${dashed(platform)}${dashed(arch)}`;

		const vscodeTaskCI = task.define(`vscode${dashed(platform)}${dashed(arch)}${dashed(minified)}-ci`, task.series(
			util.rimraf(path.join(buildRoot, destinationFolderName)),
			packageTask(platform, arch, sourceFolderName, destinationFolderName, opts)
		));
		gulp.task(vscodeTaskCI);

		const vscodeTask = task.define(`vscode${dashed(platform)}${dashed(arch)}${dashed(minified)}`, task.series(
			compileBuildTask,
			compileExtensionsBuildTask,
			minified ? minifyVSCodeTask : optimizeVSCodeTask,
			vscodeTaskCI
		));
		gulp.task(vscodeTask);

		return vscodeTask;
	});

	if (process.platform === platform && process.arch === arch) {
		gulp.task(task.define('vscode', task.series(vscode)));
		gulp.task(task.define('vscode-min', task.series(vscodeMin)));
	}
});

// Transifex Localizations

const innoSetupConfig = {
	'zh-cn': { codePage: 'CP936', defaultInfo: { name: 'Simplified Chinese', id: '$0804', } },
	'zh-tw': { codePage: 'CP950', defaultInfo: { name: 'Traditional Chinese', id: '$0404' } },
	'ko': { codePage: 'CP949', defaultInfo: { name: 'Korean', id: '$0412' } },
	'ja': { codePage: 'CP932' },
	'de': { codePage: 'CP1252' },
	'fr': { codePage: 'CP1252' },
	'es': { codePage: 'CP1252' },
	'ru': { codePage: 'CP1251' },
	'it': { codePage: 'CP1252' },
	'pt-br': { codePage: 'CP1252' },
	'hu': { codePage: 'CP1250' },
	'tr': { codePage: 'CP1254' }
};

const apiHostname = process.env.TRANSIFEX_API_URL;
const apiName = process.env.TRANSIFEX_API_NAME;
const apiToken = process.env.TRANSIFEX_API_TOKEN;

gulp.task(task.define(
	'vscode-translations-push',
	task.series(
		compileBuildTask,
		compileExtensionsBuildTask,
		optimizeVSCodeTask,
		function () {
			const pathToMetadata = './out-vscode/nls.metadata.json';
			const pathToExtensions = '.build/extensions/*';
			const pathToSetup = 'build/win32/**/{Default.isl,messages.en.isl}';

			return es.merge(
				gulp.src(pathToMetadata).pipe(i18n.createXlfFilesForCoreBundle()),
				gulp.src(pathToSetup).pipe(i18n.createXlfFilesForIsl()),
				gulp.src(pathToExtensions).pipe(i18n.createXlfFilesForExtensions())
			).pipe(i18n.findObsoleteResources(apiHostname, apiName, apiToken)
			).pipe(i18n.pushXlfFiles(apiHostname, apiName, apiToken));
		}
	)
));

// {{SQL CARBON EDIT}} Allow for gulp task to be added to update-english-xlfs.
const vscodeTranslationsExport = task.define(
	'vscode-translations-export',
	task.series(
		compileBuildTask,
		compileLocalizationExtensionsBuildTask, // {{SQL CARBON EDIT}} now include all extensions in ADS, not just a subset. (replaces 'compileExtensionsBuildTask' here).
		optimizeVSCodeTask,
		function () {
			const pathToMetadata = './out-vscode/nls.metadata.json';
			const pathToExtensions = '.build/extensions/*';
			const pathToSetup = 'build/win32/**/{Default.isl,messages.en.isl}';

			return es.merge(
				gulp.src(pathToMetadata).pipe(i18n.createXlfFilesForCoreBundle()),
				gulp.src(pathToSetup).pipe(i18n.createXlfFilesForIsl()),
				gulp.src(pathToExtensions).pipe(i18n.createXlfFilesForExtensions())
			).pipe(vfs.dest('./vscode-translations-export')); // {{SQL CARBON EDIT}} move vscode-translations-export into ADS (for safely deleting after use).
		}
	)
);
gulp.task(vscodeTranslationsExport);

// {{SQL CARBON EDIT}} Localization gulp task, runs vscodeTranslationsExport and imports a subset of the generated XLFs into the folder.
gulp.task(task.define(
	'update-english-xlfs',
	task.series(
		vscodeTranslationsExport,
		importExtensionsTask,
		task.define('delete-vscode-translations-export', util.rimraf('./vscode-translations-export'))
	)
));
// {{SQL CARBON EDIT}} end

gulp.task('vscode-translations-pull', function () {
	return es.merge([...i18n.defaultLanguages, ...i18n.extraLanguages].map(language => {
		let includeDefault = !!innoSetupConfig[language.id].defaultInfo;
		return i18n.pullSetupXlfFiles(apiHostname, apiName, apiToken, language, includeDefault).pipe(vfs.dest(`../vscode-translations-import/${language.id}/setup`));
	}));
});

gulp.task('vscode-translations-import', function () {
	// {{SQL CARBON EDIT}} - Replace function body with our own
	return new Promise(function(resolve) {
		[...i18n.defaultLanguages, ...i18n.extraLanguages].forEach(language => {
			let languageId = language.translationId ? language.translationId : language.id;
			gulp.src(`resources/xlf/${languageId}/**/*.xlf`)
				.pipe(i18n.prepareI18nFiles())
				.pipe(vfs.dest(`./i18n/${language.folderName}`));
			resolve();
		});
	});
	// {{SQL CARBON EDIT}} - End
});

// This task is only run for the MacOS build
const generateVSCodeConfigurationTask = task.define('generate-vscode-configuration', () => {
	return new Promise((resolve, reject) => {
		const buildDir = process.env['AGENT_BUILDDIRECTORY'];
		if (!buildDir) {
			return reject(new Error('$AGENT_BUILDDIRECTORY not set'));
		}

		if (process.env.VSCODE_QUALITY !== 'insider' && process.env.VSCODE_QUALITY !== 'stable') {
			return resolve();
		}

		const userDataDir = path.join(os.tmpdir(), 'tmpuserdata');
		const extensionsDir = path.join(os.tmpdir(), 'tmpextdir');
		const arch = process.env['VSCODE_ARCH'];
		const appRoot = path.join(buildDir, `VSCode-darwin-${arch}`);
		const appName = process.env.VSCODE_QUALITY === 'insider' ? 'Visual\\ Studio\\ Code\\ -\\ Insiders.app' : 'Visual\\ Studio\\ Code.app';
		const appPath = path.join(appRoot, appName, 'Contents', 'Resources', 'app', 'bin', 'code');
		const codeProc = cp.exec(
			`${appPath} --export-default-configuration='${allConfigDetailsPath}' --wait --user-data-dir='${userDataDir}' --extensions-dir='${extensionsDir}'`,
			(err, stdout, stderr) => {
				clearTimeout(timer);
				if (err) {
					console.log(`err: ${err} ${err.message} ${err.toString()}`);
					reject(err);
				}

				if (stdout) {
					console.log(`stdout: ${stdout}`);
				}

				if (stderr) {
					console.log(`stderr: ${stderr}`);
				}

				resolve();
			}
		);
		const timer = setTimeout(() => {
			codeProc.kill();
			reject(new Error('export-default-configuration process timed out'));
		}, 12 * 1000);

		codeProc.on('error', err => {
			clearTimeout(timer);
			reject(err);
		});
	});
});

const allConfigDetailsPath = path.join(os.tmpdir(), 'configuration.json');
gulp.task(task.define(
	'upload-vscode-configuration',
	task.series(
		generateVSCodeConfigurationTask,
		() => {
			const azure = require('gulp-azure-storage');

			if (!shouldSetupSettingsSearch()) {
				const branch = process.env.BUILD_SOURCEBRANCH;
				console.log(`Only runs on main and release branches, not ${branch}`);
				return;
			}

			if (!fs.existsSync(allConfigDetailsPath)) {
				throw new Error(`configuration file at ${allConfigDetailsPath} does not exist`);
			}

			const settingsSearchBuildId = getSettingsSearchBuildId(packageJson);
			if (!settingsSearchBuildId) {
				throw new Error('Failed to compute build number');
			}

			return gulp.src(allConfigDetailsPath)
				.pipe(azure.upload({
					account: process.env.AZURE_STORAGE_ACCOUNT,
					key: process.env.AZURE_STORAGE_ACCESS_KEY,
					container: 'configuration',
					prefix: `${settingsSearchBuildId}/${commit}/`
				}));
		}
	)
));

function shouldSetupSettingsSearch() {
	const branch = process.env.BUILD_SOURCEBRANCH;
	return branch && (/\/main$/.test(branch) || branch.indexOf('/release/') >= 0);
}

function getSettingsSearchBuildId(packageJson) {
	try {
		const branch = process.env.BUILD_SOURCEBRANCH;
		const branchId = branch.indexOf('/release/') >= 0 ? 0 :
			/\/main$/.test(branch) ? 1 :
				2; // Some unexpected branch

		const out = cp.execSync(`git rev-list HEAD --count`);
		const count = parseInt(out.toString());

		// <version number><commit count><branchId (avoid unlikely conflicts)>
		// 1.25.1, 1,234,567 commits, main = 1250112345671
		return util.versionStringToNumber(packageJson.version) * 1e8 + count * 10 + branchId;
	} catch (e) {
		throw new Error('Could not determine build number: ' + e.toString());
	}
}
