/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { gracefulify } from 'graceful-fs';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as minimist from 'minimist';
import * as rimraf from 'rimraf';
import * as mkdirp from 'mkdirp';
import * as vscodetest from '@vscode/test-electron';
import fetch from 'node-fetch';
import { Quality, MultiLogger, Logger, ConsoleLogger, FileLogger, measureAndLog, getDevElectronPath, getBuildElectronPath, getBuildVersion } from '../../automation';
import { retry, timeout } from './utils';

import { main as sqlMain, setup as sqlSetup } from './sql/main'; // {{SQL CARBON EDIT}}
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
import { setup as setupLaunchTests } from './areas/workbench/launch.test';*/
import { setup as setupTerminalProfileTests } from './areas/terminal/terminal-profiles.test';
import { setup as setupTerminalTabsTests } from './areas/terminal/terminal-tabs.test'; * /

const rootPath = path.join(__dirname, '..', '..', '..');

const [, , ...args] = process.argv;
const opts = minimist(args, {
	string: [
		'browser',
		'build',
		'stable-build',
		'wait-time',
		'test-repo',
		'electronArgs'
	],
	boolean: [
		'verbose',
		'remote',
		'web',
		'headless',
		'tracing'
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
	browser?: string;
	electronArgs?: string;
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

const [, , ...args] = process.argv;
const opts = minimist(args, {
	string: [
		'browser',
		'build',
		'stable-build',
		'wait-time',
		'test-repo',
		'screenshots',
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


}

const logPath = opts.log ? path.resolve(opts.log) : null;
if (logPath) {
	mkdirp.sync(path.dirname(logPath));
	function fail(errorMessage): void {
		logger.log(errorMessage);
		if (!opts.verbose) {
			console.error(errorMessage);
		}
		process.exit(1);
	}

	let quality: Quality;
	let version: string | undefined;

	function parseVersion(version: string): { major: number; minor: number; patch: number } {
		const [, major, minor, patch] = /^(\d+)\.(\d+)\.(\d+)/.exec(version)!;
		return { major: parseInt(major), minor: parseInt(minor), patch: parseInt(patch) };
	}

	//
	// #### Electron Smoke Tests ####
	//
	if (!opts.web) {
		let testCodePath = opts.build;
		let electronPath: string;

		if (testCodePath) {
			electronPath = getBuildElectronPath(testCodePath);
			version = getBuildVersion(testCodePath);
		} else {
			testCodePath = getDevElectronPath();
			electronPath = testCodePath;
			process.env.VSCODE_REPOSITORY = rootPath;
			process.env.VSCODE_DEV = '1';
			process.env.VSCODE_CLI = '1';
		}

		if (!fs.existsSync(electronPath || '')) {
			fail(`Can't find VSCode at ${electronPath}. Please run VSCode once first (scripts/code.sh, scripts\\code.bat) and try again.`);
		}

		if (process.env.VSCODE_DEV === '1') {
			quality = Quality.Dev;
		} else if (electronPath.indexOf('Code - Insiders') >= 0 /* macOS/Windows */ || electronPath.indexOf('code-insiders') /* Linux */ >= 0) {
			quality = Quality.Insiders;
		} else {
			quality = Quality.Stable;
		}

		if (opts.remote) {
			logger.log(`Running desktop remote smoke tests against ${electronPath}`);
		} else {
			logger.log(`Running desktop smoke tests against ${electronPath}`);
		}
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
				logger.log(`Running web smoke tests against ${testCodeServerPath}`);
			}
		}

		if (!testCodeServerPath) {
			process.env.VSCODE_REPOSITORY = rootPath;
			process.env.VSCODE_DEV = '1';
			process.env.VSCODE_CLI = '1';

			logger.log(`Running web smoke out of sources`);
		}

		if (process.env.VSCODE_DEV === '1') {
			quality = Quality.Dev;
		} else {
			quality = Quality.Insiders;
		}
	}

	const userDataDir = path.join(testDataPath, 'd');

	async function setupRepository(): Promise<void> {
		if (opts['test-repo']) {
			logger.log('Copying test project repository:', opts['test-repo']);
			rimraf.sync(workspacePath);
			// not platform friendly
			if (process.platform === 'win32') {
				cp.execSync(`xcopy /E "${opts['test-repo']}" "${workspacePath}"\\*`);
			} else {
				cp.execSync(`cp -R "${opts['test-repo']}" "${workspacePath}"`);
			}
		} else {
			if (!fs.existsSync(workspacePath)) {
				logger.log('Cloning test project repository...');
				const res = cp.spawnSync('git', ['clone', testRepoUrl, workspacePath], { stdio: 'inherit' });
				if (!fs.existsSync(workspacePath)) {
					throw new Error(`Clone operation failed: ${res.stderr.toString()}`);
				}
			} else {
				logger.log('Cleaning test project repository...');
				cp.spawnSync('git', ['fetch'], { cwd: workspacePath, stdio: 'inherit' });
				cp.spawnSync('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: workspacePath, stdio: 'inherit' });
				cp.spawnSync('git', ['clean', '-xdf'], { cwd: workspacePath, stdio: 'inherit' });
			}
		}
	}

	// @ts-ignore ts6133 {{SQL CARBON EDIT}} Not used (see below)
	async function ensureStableCode(): Promise<void> {
		let stableCodePath = opts['stable-build'];
		if (!stableCodePath) {
			const { major, minor } = parseVersion(version!);
			const majorMinorVersion = `${major}.${minor - 1}`;
			const versionsReq = await retry(() => measureAndLog(fetch('https://update.code.visualstudio.com/api/releases/stable', { headers: { 'x-api-version': '2' } }), 'versionReq', logger), 1000, 20);

			if (!versionsReq.ok) {
				throw new Error('Could not fetch releases from update server');
			}

			const versions: { version: string }[] = await measureAndLog(versionsReq.json(), 'versionReq.json()', logger);
			const prefix = `${majorMinorVersion}.`;
			const previousVersion = versions.find(v => v.version.startsWith(prefix));

			if (!previousVersion) {
				throw new Error(`Could not find suitable stable version ${majorMinorVersion}`);
			}

			logger.log(`Found VS Code v${version}, downloading previous VS Code version ${previousVersion.version}...`);

			let lastProgressMessage: string | undefined = undefined;
			let lastProgressReportedAt = 0;
			const stableCodeDestination = path.join(testDataPath, 's');
			const stableCodeExecutable = await retry(() => measureAndLog(vscodetest.download({
				cachePath: stableCodeDestination,
				version: previousVersion.version,
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
		logger.log('Test data path:', testDataPath);
		logger.log('Preparing smoketest setup...');

		if (!opts.web && !opts.remote && opts.build) {
			// only enabled when running with --build and not in web or remote
			await measureAndLog(ensureStableCode(logger), 'ensureStableCode', logger);
		}
		await measureAndLog(setupRepository(), 'setupRepository', logger);

		logger.log('Smoketest setup done!\n');
	}

	// Before all tests run setup
	before(async function () {
		this.timeout(5 * 60 * 1000); // increase since we download VSCode

		this.defaultOptions = {
			quality,
			codePath: opts.build,
			workspacePath,
			userDataDir,
			extensionsPath,
			logger,
			logsPath: path.join(logsRootPath, 'suite_unknown'),
			verbose: opts.verbose,
			remote: opts.remote,
			web: opts.web,
			tracing: opts.tracing,
			headless: opts.headless,
			browser: opts.browser,
			extraArgs: (opts.electronArgs || '').split(' ').map(arg => arg.trim()).filter(arg => !!arg)
		};

		await setup();
		const options = this.defaultOptions = await createOptions();
		await setup(options.logger);
	});

	// After main suite (after all tests)
	after(async function () {
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
				await promisify(ncp)(logsDir, destLogsDir);
			}
			catch (ex) {
				console.warn(`Caught exception from ncp: ${ex}`);
			}
		}

		try {
			let deleted = false;
			await measureAndLog(Promise.race([
				new Promise<void>((resolve, reject) => rimraf(testDataPath, { maxBusyTries: 10 }, error => {
					if (error) {
						reject(error);
					} else {
						deleted = true;
						resolve();
					}
				})),
				timeout(30000).then(() => {
					if (!deleted) {
						throw new Error('giving up after 30s');
					}
				})
			]), 'rimraf(testDataPath)', logger);
		} catch (error) {
			logger.log(`Unable to delete smoke test workspace: ${error}. This indicates some process is locking the workspace folder.`);
		}
	});

	describe(`VSCode Smoke Tests (${opts.web ? 'Web' : 'Electron'})`, () => {
	/* {{SQL CARBON EDIT}} Disable unused tests
	if (!opts.web) { setupDataLossTests(() => opts['stable-build'] /* Do not change, deferred for a reason! */, logger);
}
setupPreferencesTests(logger);
setupSearchTests(logger);
setupNotebookTests(logger);
setupLanguagesTests(logger);
if (opts.web) { setupTerminalTests(logger); } // Tests require playwright driver (https://github.com/microsoft/vscode/issues/146811)
setupStatusbarTests(logger);
if (quality !== Quality.Dev) { setupExtensionTests(logger); }
setupMultirootTests(logger);
if (!opts.web && !opts.remote && quality !== Quality.Dev) { setupLocalizationTests(logger); }
if (!opts.web && !opts.remote) { setupLaunchTests(logger); }
	* /
});
