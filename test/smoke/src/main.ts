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
import * as vscodetest from 'vscode-test';
import fetch from 'node-fetch';
import { Quality, MultiLogger, Logger, ConsoleLogger, FileLogger, measureAndLog } from '../../automation';
import { timeout } from './utils';

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
import { setup as setupTerminalTabsTests } from './areas/terminal/terminal-tabs.test'; */

const repoPath = path.join(__dirname, '..', '..', '..');

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
		'headless'
	],
	default: {
		verbose: false
	}
}) as {
	verbose?: boolean,
	remote?: boolean,
	headless?: boolean,
	web?: boolean,
	build?: string,
	'stable-build'?: string,
	browser?: string,
	electronArgs?: string
};

const logger = createLogger();

function createLogger(): Logger {
	const loggers: Logger[] = [];

	// Log to console if verbose
	if (opts.verbose) {
		loggers.push(new ConsoleLogger());
	}

	// Always log to log file
	const logPath = path.join(repoPath, '.build', 'logs', opts.web ? 'smoke-tests-browser' : opts.remote ? 'smoke-tests-remote' : 'smoke-tests');
	mkdirp.sync(logPath);
	loggers.push(new FileLogger(path.join(logPath, 'smoke-test-runner.log')));

	return new MultiLogger(loggers);
}

const testDataPath = path.join(os.tmpdir(), 'vscsmoke');
if (fs.existsSync(testDataPath)) {
	rimraf.sync(testDataPath);
}
fs.mkdirSync(testDataPath);
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
	process.exit(1);
}

let quality: Quality;
let version: string | undefined;

function parseVersion(version: string): { major: number, minor: number, patch: number } {
	const [, major, minor, patch] = /^(\d+)\.(\d+)\.(\d+)/.exec(version)!;
	return { major: parseInt(major), minor: parseInt(minor), patch: parseInt(patch) };
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
		process.env.VSCODE_REPOSITORY = repoPath;
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
			cp.spawnSync('git', ['clone', testRepoUrl, workspacePath]);
		} else {
			logger.log('Cleaning test project repository...');
			cp.spawnSync('git', ['fetch'], { cwd: workspacePath });
			cp.spawnSync('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: workspacePath });
			cp.spawnSync('git', ['clean', '-xdf'], { cwd: workspacePath });
		}

		// None of the current smoke tests have a dependency on the packages.
		// If new smoke tests are added that need the packages, uncomment this.
		// logger.log('Running yarn...');
		// cp.execSync('yarn', { cwd: workspacePath, stdio: 'inherit' });
	}
}

// @ts-ignore ts6133 {{SQL CARBON EDIT}} Not used (see below)
async function ensureStableCode(): Promise<void> {
	let stableCodePath = opts['stable-build'];
	if (!stableCodePath) {
		const { major, minor } = parseVersion(version!);
		const majorMinorVersion = `${major}.${minor - 1}`;
		const versionsReq = await measureAndLog(fetch('https://update.code.visualstudio.com/api/releases/stable', { headers: { 'x-api-version': '2' } }), 'versionReq', logger);

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

		const stableCodeExecutable = await measureAndLog(vscodetest.download({
			cachePath: path.join(os.tmpdir(), 'vscode-test'),
			version: previousVersion.version
		}), 'download stable code', logger);

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

before(async function () {
	this.timeout(2 * 60 * 1000); // allow two minutes for setup

	this.defaultOptions = {
		quality,
		codePath: opts.build,
		workspacePath,
		userDataDir,
		extensionsPath,
		waitTime: parseInt(opts['wait-time'] || '0') || 20,
		logger,
		verbose: opts.verbose,
		remote: opts.remote,
		web: opts.web,
		headless: opts.headless,
		browser: opts.browser,
		extraArgs: (opts.electronArgs || '').split(' ').map(a => a.trim()).filter(a => !!a)
	};

	await setup();
	const options = this.defaultOptions = await createOptions();
	await setup(options.logger);
});

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
		// TODO@tyriar TODO@meganrogge lately deleting the test root
		// folder results in timeouts of 60s or EPERM issues which
		// seems to indicate that a process (terminal?) holds onto a
		// folder within.
		//
		// Workarounds pushed for mitigation
		// - do not end up with mocha timeout errors after 60s by limiting
		//   this operation to at maximum 30s
		// - do not end up with a failing `after` call when deletion failed
		//
		// Refs: https://github.com/microsoft/vscode/issues/137725
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
	if (!opts.web) { setupDataLossTests(() => opts['stable-build'] /* Do not change, deferred for a reason! */, logger); }
	if (!opts.web) { setupPreferencesTests(logger); }
	setupSearchTests(logger);
	setupNotebookTests(logger);
	setupLanguagesTests(logger);
	setupEditorTests(logger);
	if (opts.web) { setupTerminalTests(logger); } // TODO@daniel TODO@meggan: Enable terminal tests for non-web when the desktop driver is moved to playwright
	setupStatusbarTests(!!opts.web, logger);
	if (quality !== Quality.Dev) { setupExtensionTests(logger); }
	if (!opts.web) { setupMultirootTests(logger); }
	if (!opts.web && !opts.remote && quality !== Quality.Dev) { setupLocalizationTests(logger); }
	if (!opts.web && !opts.remote) { setupLaunchTests(logger); }
	*/
});
