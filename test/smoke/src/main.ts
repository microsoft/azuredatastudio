/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { gracefulify } from 'graceful-fs'; // {{SQL CARBON EDIT}} - import graceful-fs
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as minimist from 'minimist';
import * as rimraf from 'rimraf';
import * as mkdirp from 'mkdirp';
import * as vscodetest from '@vscode/test-electron'; // {{SQL CARBON EDIT}} - import @vscode/test-electron
import { ncp } from 'ncp';
import fetch from 'node-fetch';
import { Quality, ApplicationOptions, MultiLogger, Logger, ConsoleLogger, FileLogger, measureAndLog } from '../../automation'; // {{SQL CARBON EDIT}} - import measureAndLog

import { main as sqlMain, setup as sqlSetup } from './sql/main'; // {{SQL CARBON EDIT}}
import { retry } from './utils'; // {{SQL CARBON EDIT}} - import retry from utils
/*import { setup as setupDataMigrationTests } from './areas/workbench/data-migration.test';
import { setup as setupDataLossTests } from './areas/workbench/data-loss.test';
import { setup as setupDataPreferencesTests } from './areas/preferences/preferences.test';
import { setup as setupDataSearchTests } from './areas/search/search.test';
import { setup as setupDataNotebookTests } from './areas/notebook/notebook.test';
import { setup as setupDataLanguagesTests } from './areas/languages/languages.test';
import { setup as setupDataEditorTests } from './areas/editor/editor.test';
import { setup as setupDataStatusbarTests } from './areas/statusbar/statusbar.test';
import { setup as setupDataExtensionTests } from './areas/extensions/extensions.test';
import { setup as setupDataMultirootTests } from './areas/multiroot/multiroot.test';
import { setup as setupDataLocalizationTests } from './areas/workbench/localization.test';
import { setup as setupLaunchTests } from './areas/workbench/launch.test';
import { setup as setupTaskTests } from './areas/task/task.test';*/

const rootPath = path.join(__dirname, '..', '..', '..');

const [, , ...args] = process.argv;
const opts = minimist(args, {
	string: [
		'browser',
		'build',
		'stable-build',
		'wait-time',
		'test-repo',
		'screenshots',
		'log',
		'extensionsDir', // {{SQL CARBON EDIT}} Let callers control extensions dir for non-packaged extensions
		'electronArgs'
	],
	boolean: [
		'verbose',
		'remote',
		'web',
		'headless'
	],
	default: {
		verbose: false
	}
}) as {
	verbose?: boolean;
	remote?: boolean;
	headless?: boolean;
	web?: boolean;
	tracing?: boolean;
	build?: string;
	'stable-build'?: string;
	browser?: 'webkit' | 'chromium' | 'firefox' | undefined; // {{SQL CARBON EDIT}} - string literal types
	electronArgs?: string;
	extensionsDir?: string; // {{SQL CARBON EDIT}}
	log?: string; // {{SQL CARBON EDIT}}
	screenshots?: string; // {{SQL CARBON EDIT}}
	_: string[]
};

const logsRootPath = (() => {
	const logsParentPath = path.join(rootPath, '.build', 'logs');

	let logsName: string;
	if (opts.web) {
		logsName = 'smoke-tests-browser';
	} else if (opts.remote) {
		logsName = 'smoke-tests-remote';
	} else {
		logsName = 'smoke-tests-electron';
	}

	return path.join(logsParentPath, logsName);
})();

const crashesRootPath = (() => {
	const crashesParentPath = path.join(rootPath, '.build', 'crashes');

	let crashesName: string;
	if (opts.web) {
		crashesName = 'smoke-tests-browser';
	} else if (opts.remote) {
		crashesName = 'smoke-tests-remote';
	} else {
		crashesName = 'smoke-tests-electron';
	}

	return path.join(crashesParentPath, crashesName);
})();

const logger = createLogger();

function createLogger(): Logger {
	const loggers: Logger[] = [];

	// Log to console if verbose
	if (opts.verbose) {
		loggers.push(new ConsoleLogger());
	}

	// Prepare logs rot path
	fs.rmSync(logsRootPath, { recursive: true, force: true, maxRetries: 3 });
	mkdirp.sync(logsRootPath);

	// Always log to log file
	loggers.push(new FileLogger(path.join(logsRootPath, 'smoke-test-runner.log')));

	return new MultiLogger(loggers);
}

try {
	gracefulify(fs);
} catch (error) {
	logger.log(`Error enabling graceful-fs: ${error}`);
}

const testDataPath = path.join(os.tmpdir(), 'vscsmoke');
if (fs.existsSync(testDataPath)) {
	rimraf.sync(testDataPath);
}
mkdirp.sync(testDataPath);
process.once('exit', () => {
	try {
		rimraf.sync(testDataPath);
	} catch {
		// noop
	}
});

const testRepoUrl = 'https://github.com/Microsoft/azuredatastudio-smoke-test-repo.git';
const workspacePath = path.join(testDataPath, 'azuredatastudio-smoke-test-repo');
// {{SQL CARBON EDIT}} Let callers control extensions dir for non-packaged extensions
let extensionsPath = opts.extensionsDir;
if (!extensionsPath) {
	extensionsPath = path.join(testDataPath, 'extensions-dir');
	mkdirp.sync(extensionsPath);
}
console.log(`Using extensions dir : ${extensionsPath}`);


const screenshotsPath = opts.screenshots ? path.resolve(opts.screenshots) : null;
if (screenshotsPath) {
	mkdirp.sync(screenshotsPath);
}

const logPath = opts.log ? path.resolve(opts.log) : null;
if (logPath) {
	mkdirp.sync(path.dirname(logPath));
}

function fail(errorMessage): void {
	logger.log(errorMessage);
	if (!opts.verbose) {
		console.error(errorMessage);
	}
	process.exit(1);
}

const repoPath = path.join(__dirname, '..', '..', '..');

let quality: Quality;
let version: string | undefined;

function parseVersion(version: string): { major: number, minor: number, patch: number } {
	const [, major, minor, patch] = /^(\d+)\.(\d+)\.(\d+)/.exec(version)!;
	return { major: parseInt(major), minor: parseInt(minor), patch: parseInt(patch) };
}

function parseQuality(): Quality {
	if (process.env.VSCODE_DEV === '1') {
		return Quality.Dev;
	}

	const quality = process.env.VSCODE_QUALITY ?? '';

	switch (quality) {
		case 'stable':
			return Quality.Stable;
		case 'insider':
			return Quality.Insiders;
		case 'exploration':
			return Quality.Exploration;
		case 'oss':
			return Quality.OSS;
		default:
			return Quality.Dev;
	}
}

//
// #### Electron Smoke Tests ####
//
if (!opts.web) {

	function getDevElectronPath(): string {
		const buildPath = path.join(repoPath, '.build');
		const product = require(path.join(repoPath, 'product.json'));

		switch (process.platform) {
			case 'darwin':
				return path.join(buildPath, 'electron', `${product.nameLong}.app`, 'Contents', 'MacOS', 'Electron');
			case 'linux':
				return path.join(buildPath, 'electron', `${product.applicationName}`);
			case 'win32':
				return path.join(buildPath, 'electron', `${product.nameShort}.exe`);
			default:
				throw new Error('Unsupported platform.');
		}
	}

	function getBuildElectronPath(root: string): string {
		switch (process.platform) {
			case 'darwin':
				return path.join(root, 'Contents', 'MacOS', 'Electron');
			case 'linux': {
				const product = require(path.join(root, 'resources', 'app', 'product.json'));
				return path.join(root, product.applicationName);
			}
			case 'win32': {
				const product = require(path.join(root, 'resources', 'app', 'product.json'));
				return path.join(root, `${product.nameShort}.exe`);
			}
			default:
				throw new Error('Unsupported platform.');
		}
	}

	function getBuildVersion(root: string): string {
		switch (process.platform) {
			case 'darwin':
				return require(path.join(root, 'Contents', 'Resources', 'app', 'package.json')).version;
			default:
				return require(path.join(root, 'resources', 'app', 'package.json')).version;
		}
	}

	let testCodePath = opts.build;
	let electronPath: string;

	if (testCodePath) {
		electronPath = getBuildElectronPath(testCodePath);
		version = getBuildVersion(testCodePath);
	} else {
		testCodePath = getDevElectronPath();
		electronPath = testCodePath;
		process.env.VSCODE_REPOSITORY = repoPath;
		process.env.VSCODE_DEV = '1';
		process.env.VSCODE_CLI = '1';
	}

	if (!fs.existsSync(electronPath || '')) {
		fail(`Can't find VSCode at ${electronPath}.`);
	}

	quality = parseQuality();

	console.log(`Running desktop smoke tests against ${electronPath}`);
}

//
// #### Web Smoke Tests ####
//
else {
	const testCodeServerPath = opts.build || process.env.VSCODE_REMOTE_SERVER_PATH;

	if (typeof testCodeServerPath === 'string') {
		if (!fs.existsSync(testCodeServerPath)) {
			fail(`Can't find Code server at ${testCodeServerPath}.`);
		} else {
			console.log(`Running web smoke tests against ${testCodeServerPath}`);
		}
	}

	if (!testCodeServerPath) {
		process.env.VSCODE_REPOSITORY = repoPath;
		process.env.VSCODE_DEV = '1';
		process.env.VSCODE_CLI = '1';

		console.log(`Running web smoke out of sources`);
	}

	quality = parseQuality();
}

logger.log(`VS Code product quality: ${quality}.`);

const userDataDir = path.join(testDataPath, 'd');

async function setupRepository(): Promise<void> {
	if (opts['test-repo']) {
		console.log('*** Copying test project repository:', opts['test-repo']);
		rimraf.sync(workspacePath);
		// not platform friendly
		if (process.platform === 'win32') {
			cp.execSync(`xcopy /E "${opts['test-repo']}" "${workspacePath}"\\*`);
		} else {
			cp.execSync(`cp -R "${opts['test-repo']}" "${workspacePath}"`);
		}

	} else {
		if (!fs.existsSync(workspacePath)) {
			console.log('*** Cloning test project repository...');
			cp.spawnSync('git', ['clone', testRepoUrl, workspacePath]);
		} else {
			console.log('*** Cleaning test project repository...');
			cp.spawnSync('git', ['fetch'], { cwd: workspacePath });
			cp.spawnSync('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: workspacePath });
			cp.spawnSync('git', ['clean', '-xdf'], { cwd: workspacePath });
		}

		// None of the current smoke tests have a dependency on the packages.
		// If new smoke tests are added that need the packages, uncomment this.
		// console.log('*** Running yarn...');
		// cp.execSync('yarn', { cwd: workspacePath, stdio: 'inherit' });
	}
}

// @ts-ignore ts6133 {{SQL CARBON EDIT}} Not used (see below)
async function ensureStableCode(): Promise<void> {
	if (opts.web || !opts['build']) {
		return;
	}

	let stableCodePath = opts['stable-build'];
	if (!stableCodePath) {
		const current = parseVersion(version!);
		const versionsReq = await retry(() => measureAndLog(() => fetch('https://update.code.visualstudio.com/api/releases/stable'), 'versionReq', logger), 1000, 20);

		if (!versionsReq.ok) {
			throw new Error('Could not fetch releases from update server');
		}

		const versions: string[] = await measureAndLog(() => versionsReq.json(), 'versionReq.json()', logger);
		const stableVersion = versions.find(raw => {
			const version = parseVersion(raw);
			return version.major < current.major || (version.major === current.major && version.minor < current.minor);
		});

		if (!stableVersion) {
			throw new Error(`Could not find suitable stable version for ${version}`);
		}

		logger.log(`Found VS Code v${version}, downloading previous VS Code version ${stableVersion}...`);

		let lastProgressMessage: string | undefined = undefined;
		let lastProgressReportedAt = 0;
		const stableCodeDestination = path.join(testDataPath, 's');
		const stableCodeExecutable = await retry(() => measureAndLog(() => vscodetest.download({
			cachePath: stableCodeDestination,
			version: stableVersion,
			extractSync: true,
			reporter: {
				report: report => {
					let progressMessage = `download stable code progress: ${report.stage}`;
					const now = Date.now();
					if (progressMessage !== lastProgressMessage || now - lastProgressReportedAt > 10000) {
						lastProgressMessage = progressMessage;
						lastProgressReportedAt = now;

						if (report.stage === 'downloading') {
							progressMessage += ` (${report.bytesSoFar}/${report.totalBytes})`;
						}

						logger.log(progressMessage);
					}
				},
				error: error => logger.log(`download stable code error: ${error}`)
			}
		}), 'download stable code', logger), 1000, 3, () => new Promise<void>((resolve, reject) => {
			rimraf(stableCodeDestination, { maxBusyTries: 10 }, error => {
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			});
		}));

		if (process.platform === 'darwin') {
			// Visual Studio Code.app/Contents/MacOS/Electron
			stableCodePath = path.dirname(path.dirname(path.dirname(stableCodeExecutable)));
		} else {
			// VSCode/Code.exe (Windows) | VSCode/code (Linux)
			stableCodePath = path.dirname(stableCodeExecutable);
		}
	}

	if (!fs.existsSync(stableCodePath)) {
		throw new Error(`Can't find Stable VSCode at ${stableCodePath}.`);
	}

	logger.log(`Using stable build ${stableCodePath} for migration tests`);

	opts['stable-build'] = stableCodePath;
}

async function setup(): Promise<void> {
	console.log('*** Test data:', testDataPath);
	console.log('*** Preparing smoketest setup...');

	// await ensureStableCode(); {{SQL CARBON EDIT}} Smoketests no longer need to download VS Code since they run against ADS
	await setupRepository();

	console.log('*** Smoketest setup done!\n');
}

function createOptions(): ApplicationOptions {
	const loggers: Logger[] = [];

	if (opts.verbose) {
		loggers.push(new ConsoleLogger());
	}

	// Prepare logs root path
	fs.rmSync(logsRootPath, { recursive: true, force: true, maxRetries: 3 });
	mkdirp.sync(logsRootPath);

	// Always log to log file
	loggers.push(new FileLogger(path.join(logsRootPath, 'smoke-test-runner.log')));

	return {
		quality,
		codePath: opts.build,
		workspacePath,
		userDataDir,
		extensionsPath: extensionsPath ?? '', // {{SQL CARBON EDIT}} null coalescing
		logger,
		logsPath: path.join(logsRootPath, 'suite_unknown'),
		crashesPath: path.join(crashesRootPath, 'suite_unknown'),
		verbose: opts.verbose,
		remote: opts.remote,
		web: opts.web,
		tracing: opts.tracing,
		headless: opts.headless,
		browser: opts.browser,
		extraArgs: (opts.electronArgs || '').split(' ').map(a => a.trim()).filter(a => !!a)
	};
}

before(async function () {
	this.timeout(2 * 60 * 1000); // allow two minutes for setup
	await setup();
	this.defaultOptions = createOptions();
	await sqlSetup(this.defaultOptions);
});

after(async function () {
	await new Promise(c => setTimeout(c, 500)); // wait for shutdown

	if (opts.log) {
		const logsDir = path.join(userDataDir, 'logs');
		const destLogsDir = path.join(path.dirname(opts.log), 'logs');

		// {{ SQL CARBON EDIT }}
		/**
		 * The logs directory is not present during the ADS web build, but is during the Darwin build.
		 * In situations where the directory is missing and a copy attempt is made, bash exits with code 255 and raises an error
		 * explaining that there's no such file or directory. This prevents that error from occurring.
		 */
		try {
			await new Promise((c, e) => ncp(logsDir, destLogsDir, err => err ? e(err) : c(undefined)));
		}
		catch (ex) {
			console.warn(`Caught exception from ncp: ${ex}`);
		}
	}

	await new Promise((c, e) => rimraf(testDataPath, { maxBusyTries: 10 }, err => err ? e(err) : c(undefined)));
});

sqlMain(opts);

if (!opts.web && opts['build'] && !opts['remote']) {
	describe(`Stable vs Insiders Smoke Tests: This test MUST run before releasing`, () => {
		// setupDataMigrationTests(opts, testDataPath); {{SQL CARBON EDIT}} Remove unused tests
	});
}

describe(`VSCode Smoke Tests (${opts.web ? 'Web' : 'Electron'})`, () => {
	/* {{SQL CARBON EDIT}} Disable unused tests
	if (!opts.web) { setupDataLossTests(opts); }
	if (!opts.web) { setupDataPreferencesTests(opts); }
	setupDataSearchTests(opts);
	setupDataNotebookTests(opts);
	setupDataLanguagesTests(opts);
	setupDataEditorTests(opts);
	setupDataStatusbarTests(opts);
	if (quality !== Quality.Dev) { setupExtensionTests(logger); }
	if (!opts.web) { setupDataMultirootTests(opts); }
	if (!opts.web && !opts.remote && quality !== Quality.Dev) { setupLocalizationTests(logger); }
	if (!opts.web) { setupLaunchTests(); }
	*/
});
