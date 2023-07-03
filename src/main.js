/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

/**
 * @typedef {import('./vs/base/common/product').IProductConfiguration} IProductConfiguration
 * @typedef {import('./vs/base/node/languagePacks').NLSConfiguration} NLSConfiguration
 * @typedef {import('./vs/platform/environment/common/argv').NativeParsedArgs} NativeParsedArgs
 */

const perf = require('./vs/base/common/performance');
perf.mark('code/didStartMain');

const path = require('path');
const fs = require('fs');
const os = require('os');
const bootstrap = require('./bootstrap');
const bootstrapNode = require('./bootstrap-node');
const { getUserDataPath } = require('./vs/platform/environment/node/userDataPath');
const { stripComments } = require('./vs/base/common/stripComments');
const { getUNCHost, addUNCHostToAllowlist } = require('./vs/base/node/unc');
/** @type {Partial<IProductConfiguration>} */
const product = require('../product.json');
const { app, protocol, crashReporter, Menu } = require('electron');

// Enable portable support
const portable = bootstrapNode.configurePortable(product);

// Enable ASAR support
bootstrap.enableASARSupport();

// Enable sandbox globally unless disabled via `--no-sandbox` argument
const args = parseCLIArgs();
// if (args['sandbox']) {  // {{SQL CARBON EDIT}} - disable sandbox
//	app.enableSandbox();
// }

if (args['nogpu']) { // {{SQL CARBON EDIT}}
	app.disableHardwareAcceleration(); // {{SQL CARBON EDIT}}
	app.commandLine.appendSwitch('headless'); // {{SQL CARBON EDIT}}
	app.commandLine.appendSwitch('disable-gpu'); // {{SQL CARBON EDIT}}
} // {{SQL CARBON EDIT}}


// Set userData path before app 'ready' event
const userDataPath = getUserDataPath(args, product.nameShort ?? 'azuredatastudio-oss-dev'); // {{SQL CARBON EDIT}} - change app name
if (process.platform === 'win32') {
	const userDataUNCHost = getUNCHost(userDataPath);
	if (userDataUNCHost) {
		addUNCHostToAllowlist(userDataUNCHost); // enables to use UNC paths in userDataPath
	}
}
app.setPath('userData', userDataPath);

// Resolve code cache path
const codeCachePath = getCodeCachePath();

// Configure static command line arguments
const argvConfig = configureCommandlineSwitchesSync(args);

// Disable default menu (https://github.com/electron/electron/issues/35512)
Menu.setApplicationMenu(null);

// Configure crash reporter
perf.mark('code/willStartCrashReporter');
// If a crash-reporter-directory is specified we store the crash reports
// in the specified directory and don't upload them to the crash server.
//
// Appcenter crash reporting is enabled if
// * enable-crash-reporter runtime argument is set to 'true'
// * --disable-crash-reporter command line parameter is not set
//
// Disable crash reporting in all other cases.
if (args['crash-reporter-directory'] || (argvConfig['enable-crash-reporter'] && !args['disable-crash-reporter'])) {
	configureCrashReporter();
}
perf.mark('code/didStartCrashReporter');

// Set logs path before app 'ready' event if running portable
// to ensure that no 'logs' folder is created on disk at a
// location outside of the portable directory
// (https://github.com/microsoft/vscode/issues/56651)
if (portable && portable.isPortable) {
	app.setAppLogsPath(path.join(userDataPath, 'logs'));
}

// Register custom schemes with privileges
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'vscode-webview',
		privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, allowServiceWorkers: true, }
	},
	{
		scheme: 'vscode-file',
		privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true }
	}
]);

// Global app listeners
registerListeners();

/**
 * Support user defined locale: load it early before app('ready')
 * to have more things running in parallel.
 *
 * @type {Promise<NLSConfiguration> | undefined}
 */
let nlsConfigurationPromise = undefined;

/**
 * @type {String}
 **/
// Use the most preferred OS language for language recommendation.
// The API might return an empty array on Linux, such as when
// the 'C' locale is the user's only configured locale.
// No matter the OS, if the array is empty, default back to 'en'.
const resolved = app.getPreferredSystemLanguages()?.[0] ?? 'en';
const osLocale = processZhLocale(resolved.toLowerCase());
const metaDataFile = path.join(__dirname, 'nls.metadata.json');
const locale = getUserDefinedLocale(argvConfig);
if (locale) {
	const { getNLSConfiguration } = require('./vs/base/node/languagePacks');
	nlsConfigurationPromise = getNLSConfiguration(product.commit, userDataPath, metaDataFile, locale, osLocale);
}

// Pass in the locale to Electron so that the
// Windows Control Overlay is rendered correctly on Windows.
// For now, don't pass in the locale on macOS due to
// https://github.com/microsoft/vscode/issues/167543.
// If the locale is `qps-ploc`, the Microsoft
// Pseudo Language Language Pack is being used.
// In that case, use `en` as the Electron locale.

if (process.platform === 'win32' || process.platform === 'linux') {
	const electronLocale = (!locale || locale === 'qps-ploc') ? 'en' : locale;
	app.commandLine.appendSwitch('lang', electronLocale);
}

// Load our code once ready
app.once('ready', function () {
	if (args['trace']) {
		const contentTracing = require('electron').contentTracing;

		const traceOptions = {
			categoryFilter: args['trace-category-filter'] || '*',
			traceOptions: args['trace-options'] || 'record-until-full,enable-sampling'
		};

		contentTracing.startRecording(traceOptions).finally(() => onReady());
	} else {
		onReady();
	}
});

/**
 * Main startup routine
 *
 * @param {string | undefined} codeCachePath
 * @param {NLSConfiguration} nlsConfig
 */
function startup(codeCachePath, nlsConfig) {
	nlsConfig._languagePackSupport = true;

	process.env['VSCODE_NLS_CONFIG'] = JSON.stringify(nlsConfig);
	process.env['VSCODE_CODE_CACHE_PATH'] = codeCachePath || '';

	// Load main in AMD
	perf.mark('code/willLoadMainBundle');
	require('./bootstrap-amd').load('vs/code/electron-main/main', () => {
		perf.mark('code/didLoadMainBundle');
	});
}

async function onReady() {
	perf.mark('code/mainAppReady');

	try {
		const [, nlsConfig] = await Promise.all([mkdirpIgnoreError(codeCachePath), resolveNlsConfiguration()]);

		startup(codeCachePath, nlsConfig);
	} catch (error) {
		console.error(error);
	}
}

/**
 * @param {NativeParsedArgs} cliArgs
 */
function configureCommandlineSwitchesSync(cliArgs) {
	const SUPPORTED_ELECTRON_SWITCHES = [

		// alias from us for --disable-gpu
		'disable-hardware-acceleration',

		// override for the color profile to use
		'force-color-profile'
	];

	if (process.platform === 'linux') {

		// Force enable screen readers on Linux via this flag
		SUPPORTED_ELECTRON_SWITCHES.push('force-renderer-accessibility');
	}

	const SUPPORTED_MAIN_PROCESS_SWITCHES = [

		// Persistently enable proposed api via argv.json: https://github.com/microsoft/vscode/issues/99775
		'enable-proposed-api',

		// Log level to use. Default is 'info'. Allowed values are 'error', 'warn', 'info', 'debug', 'trace', 'off'.
		'log-level'
	];

	// Read argv config
	const argvConfig = readArgvConfigSync();

	Object.keys(argvConfig).forEach(argvKey => {
		const argvValue = argvConfig[argvKey];

		// Append Electron flags to Electron
		if (SUPPORTED_ELECTRON_SWITCHES.indexOf(argvKey) !== -1) {

			// Color profile
			if (argvKey === 'force-color-profile') {
				if (argvValue) {
					app.commandLine.appendSwitch(argvKey, argvValue);
				}
			}

			// Others
			else if (argvValue === true || argvValue === 'true') {
				if (argvKey === 'disable-hardware-acceleration') {
					app.disableHardwareAcceleration(); // needs to be called explicitly
				} else {
					app.commandLine.appendSwitch(argvKey);
				}
			}
		}

		// Append main process flags to process.argv
		else if (SUPPORTED_MAIN_PROCESS_SWITCHES.indexOf(argvKey) !== -1) {
			switch (argvKey) {
				case 'enable-proposed-api':
					if (Array.isArray(argvValue)) {
						argvValue.forEach(id => id && typeof id === 'string' && process.argv.push('--enable-proposed-api', id));
					} else {
						console.error(`Unexpected value for \`enable-proposed-api\` in argv.json. Expected array of extension ids.`);
					}
					break;

				case 'log-level':
					if (typeof argvValue === 'string') {
						process.argv.push('--log', argvValue);
					} else if (Array.isArray(argvValue)) {
						for (const value of argvValue) {
							process.argv.push('--log', value);
						}
					}
					break;
			}
		}
	});

	// Following features are disabled from the runtime:
	// `CalculateNativeWinOcclusion` - Disable native window occlusion tracker (https://groups.google.com/a/chromium.org/g/embedder-dev/c/ZF3uHHyWLKw/m/VDN2hDXMAAAJ)
	app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

	// Support JS Flags
	const jsFlags = getJSFlags(cliArgs);
	if (jsFlags) {
		app.commandLine.appendSwitch('js-flags', jsFlags);
	}

	return argvConfig;
}

function readArgvConfigSync() {

	// Read or create the argv.json config file sync before app('ready')
	const argvConfigPath = getArgvConfigPath();
	let argvConfig;
	try {
		argvConfig = JSON.parse(stripComments(fs.readFileSync(argvConfigPath).toString()));
	} catch (error) {
		if (error && error.code === 'ENOENT') {
			createDefaultArgvConfigSync(argvConfigPath);
		} else {
			console.warn(`Unable to read argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
		}
	}

	// Fallback to default
	if (!argvConfig) {
		argvConfig = {};
	}

	return argvConfig;
}

/**
 * @param {string} argvConfigPath
 */
function createDefaultArgvConfigSync(argvConfigPath) {
	try {

		// Ensure argv config parent exists
		const argvConfigPathDirname = path.dirname(argvConfigPath);
		if (!fs.existsSync(argvConfigPathDirname)) {
			fs.mkdirSync(argvConfigPathDirname);
		}

		// Default argv content
		const defaultArgvConfigContent = [
			'// This configuration file allows you to pass permanent command line arguments to VS Code.',
			'// Only a subset of arguments is currently supported to reduce the likelihood of breaking',
			'// the installation.',
			'//',
			'// PLEASE DO NOT CHANGE WITHOUT UNDERSTANDING THE IMPACT',
			'//',
			'// NOTE: Changing this file requires a restart of VS Code.',
			'{',
			'	// Use software rendering instead of hardware accelerated rendering.',
			'	// This can help in cases where you see rendering issues in VS Code.',
			'	// "disable-hardware-acceleration": true',
			'}'
		];

		// Create initial argv.json with default content
		fs.writeFileSync(argvConfigPath, defaultArgvConfigContent.join('\n'));
	} catch (error) {
		console.error(`Unable to create argv.json configuration file in ${argvConfigPath}, falling back to defaults (${error})`);
	}
}

function getArgvConfigPath() {
	const vscodePortable = process.env['VSCODE_PORTABLE'];
	if (vscodePortable) {
		return path.join(vscodePortable, 'argv.json');
	}

	let dataFolderName = product.dataFolderName;
	if (process.env['VSCODE_DEV']) {
		dataFolderName = `${dataFolderName}-dev`;
	}

	// @ts-ignore
	return path.join(os.homedir(), dataFolderName, 'argv.json');
}

function configureCrashReporter() {

	let crashReporterDirectory = args['crash-reporter-directory'];
	let submitURL = '';
	if (crashReporterDirectory) {
		crashReporterDirectory = path.normalize(crashReporterDirectory);

		if (!path.isAbsolute(crashReporterDirectory)) {
			console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory must be absolute.`);
			app.exit(1);
		}

		if (!fs.existsSync(crashReporterDirectory)) {
			try {
				fs.mkdirSync(crashReporterDirectory, { recursive: true });
			} catch (error) {
				console.error(`The path '${crashReporterDirectory}' specified for --crash-reporter-directory does not seem to exist or cannot be created.`);
				app.exit(1);
			}
		}

		// Crashes are stored in the crashDumps directory by default, so we
		// need to change that directory to the provided one
		console.log(`Found --crash-reporter-directory argument. Setting crashDumps directory to be '${crashReporterDirectory}'`);
		app.setPath('crashDumps', crashReporterDirectory);
	}

	// Otherwise we configure the crash reporter from product.json
	else {
		const appCenter = product.appCenter;
		if (appCenter) {
			const isWindows = (process.platform === 'win32');
			const isLinux = (process.platform === 'linux');
			const isDarwin = (process.platform === 'darwin');
			const crashReporterId = argvConfig['crash-reporter-id'];
			const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
			if (uuidPattern.test(crashReporterId)) {
				if (isWindows) {
					switch (process.arch) {
						case 'ia32':
							submitURL = appCenter['win32-ia32'];
							break;
						case 'x64':
							submitURL = appCenter['win32-x64'];
							break;
						case 'arm64':
							submitURL = appCenter['win32-arm64'];
							break;
					}
				} else if (isDarwin) {
					if (product.darwinUniversalAssetId) {
						submitURL = appCenter['darwin-universal'];
					} else {
						switch (process.arch) {
							case 'x64':
								submitURL = appCenter['darwin'];
								break;
							case 'arm64':
								submitURL = appCenter['darwin-arm64'];
								break;
						}
					}
				} else if (isLinux) {
					submitURL = appCenter['linux-x64'];
				}
				submitURL = submitURL.concat('&uid=', crashReporterId, '&iid=', crashReporterId, '&sid=', crashReporterId);
				// Send the id for child node process that are explicitly starting crash reporter.
				// For vscode this is ExtensionHost process currently.
				const argv = process.argv;
				const endOfArgsMarkerIndex = argv.indexOf('--');
				if (endOfArgsMarkerIndex === -1) {
					argv.push('--crash-reporter-id', crashReporterId);
				} else {
					// if the we have an argument "--" (end of argument marker)
					// we cannot add arguments at the end. rather, we add
					// arguments before the "--" marker.
					argv.splice(endOfArgsMarkerIndex, 0, '--crash-reporter-id', crashReporterId);
				}
			}
		}
	}

	// Start crash reporter for all processes
	/* {{SQL CARBON EDIT}} Disable crash reporting until we're actually set up to use it
	const productName = (product.crashReporter ? product.crashReporter.productName : undefined) || product.nameShort;
	const companyName = (product.crashReporter ? product.crashReporter.companyName : undefined) || 'Microsoft';
	const uploadToServer = Boolean(!process.env['VSCODE_DEV'] && submitURL && !crashReporterDirectory);
	crashReporter.start({
		companyName,
		productName: process.env['VSCODE_DEV'] ? `${productName} Dev` : productName,
		submitURL,
		uploadToServer,
		compress: true
	});
	*/
}

/**
 * @param {NativeParsedArgs} cliArgs
 * @returns {string | null}
 */
function getJSFlags(cliArgs) {
	const jsFlags = [];

	// Add any existing JS flags we already got from the command line
	if (cliArgs['js-flags']) {
		jsFlags.push(cliArgs['js-flags']);
	}

	return jsFlags.length > 0 ? jsFlags.join(' ') : null;
}

/**
 * @returns {NativeParsedArgs}
 */
function parseCLIArgs() {
	const minimist = require('minimist');

	return minimist(process.argv, {
		string: [
			'user-data-dir',
			'locale',
			'js-flags',
			'crash-reporter-directory'
		],
		default: {
			'sandbox': false // {{SQL CARBON EDIT} - set sandbox to false
		},
		alias: {
			'no-sandbox': 'sandbox'
		}
	});
}

function registerListeners() {

	/**
	 * macOS: when someone drops a file to the not-yet running VSCode, the open-file event fires even before
	 * the app-ready event. We listen very early for open-file and remember this upon startup as path to open.
	 *
	 * @type {string[]}
	 */
	const macOpenFiles = [];
	global['macOpenFiles'] = macOpenFiles;
	app.on('open-file', function (event, path) {
		macOpenFiles.push(path);
	});

	/**
	 * macOS: react to open-url requests.
	 *
	 * @type {string[]}
	 */
	const openUrls = [];
	const onOpenUrl =
		/**
		 * @param {{ preventDefault: () => void; }} event
		 * @param {string} url
		 */
		function (event, url) {
			event.preventDefault();

			openUrls.push(url);
		};

	app.on('will-finish-launching', function () {
		app.on('open-url', onOpenUrl);
	});

	global['getOpenUrls'] = function () {
		app.removeListener('open-url', onOpenUrl);

		return openUrls;
	};
}

/**
 * @returns {string | undefined} the location to use for the code cache
 * or `undefined` if disabled.
 */
function getCodeCachePath() {

	// explicitly disabled via CLI args
	if (process.argv.indexOf('--no-cached-data') > 0) {
		return undefined;
	}

	// running out of sources
	if (process.env['VSCODE_DEV']) {
		return undefined;
	}

	// require commit id
	const commit = product.commit;
	if (!commit) {
		return undefined;
	}

	return path.join(userDataPath, 'CachedData', commit);
}

/**
 * @param {string} dir
 * @returns {Promise<string>}
 */
function mkdirp(dir) {
	return new Promise((resolve, reject) => {
		fs.mkdir(dir, { recursive: true }, err => (err && err.code !== 'EEXIST') ? reject(err) : resolve(dir));
	});
}

/**
 * @param {string | undefined} dir
 * @returns {Promise<string | undefined>}
 */
async function mkdirpIgnoreError(dir) {
	if (typeof dir === 'string') {
		try {
			await mkdirp(dir);

			return dir;
		} catch (error) {
			// ignore
		}
	}

	return undefined;
}

//#region NLS Support

/**
 * @param {string} appLocale
 * @returns string
 */
function processZhLocale(appLocale) {
	if (appLocale.startsWith('zh')) {
		const region = appLocale.split('-')[1];
		// On Windows and macOS, Chinese languages returned by
		// app.getPreferredSystemLanguages() start with zh-hans
		// for Simplified Chinese or zh-hant for Traditional Chinese,
		// so we can easily determine whether to use Simplified or Traditional.
		// However, on Linux, Chinese languages returned by that same API
		// are of the form zh-XY, where XY is a country code.
		// For China (CN), Singapore (SG), and Malaysia (MY)
		// country codes, assume they use Simplified Chinese.
		// For other cases, assume they use Traditional.
		if (['hans', 'cn', 'sg', 'my'].includes(region)) {
			return 'zh-cn';
		}
		return 'zh-tw';
	}
	return appLocale;
}

/**
 * Resolve the NLS configuration
 *
 * @return {Promise<NLSConfiguration>}
 */
async function resolveNlsConfiguration() {

	// First, we need to test a user defined locale. If it fails we try the app locale.
	// If that fails we fall back to English.
	let nlsConfiguration = nlsConfigurationPromise ? await nlsConfigurationPromise : undefined;
	if (nlsConfiguration) {
		return nlsConfiguration;
	}

	// Try to use the app locale. Please note that the app locale is only
	// valid after we have received the app ready event. This is why the
	// code is here.

	/**
	 * @type string
	 */
	let appLocale = app.getLocale();
	if (!appLocale) {
		return { locale: 'en', osLocale, availableLanguages: {} };
	}

	// See above the comment about the loader and case sensitiveness
	appLocale = processZhLocale(appLocale.toLowerCase());

	const { getNLSConfiguration } = require('./vs/base/node/languagePacks');
	nlsConfiguration = await getNLSConfiguration(product.commit, userDataPath, metaDataFile, appLocale, osLocale);
	return nlsConfiguration ?? { locale: 'en', osLocale, availableLanguages: {} };
}

/**
 * Language tags are case insensitive however an amd loader is case sensitive
 * To make this work on case preserving & insensitive FS we do the following:
 * the language bundles have lower case language tags and we always lower case
 * the locale we receive from the user or OS.
 *
 * @param {{ locale: string | undefined; }} argvConfig
 * @returns {string | undefined}
 */
function getUserDefinedLocale(argvConfig) {
	const locale = args['locale'];
	if (locale) {
		return locale.toLowerCase(); // a directly provided --locale always wins
	}

	return argvConfig.locale && typeof argvConfig.locale === 'string' ? argvConfig.locale.toLowerCase() : undefined;
}

//#endregion
