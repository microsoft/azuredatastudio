/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/// <reference path="typings/require.d.ts" />

//@ts-check
'use strict';

// Simple module style to support node.js and browser environments
(function (globalThis, factory) {

	// Node.js
	if (typeof exports === 'object') {
		module.exports = factory();
	}

	// Browser
	else {
		globalThis.MonacoBootstrapWindow = factory();
	}
}(this, function () {
	const preloadGlobals = globals();
	const sandbox = preloadGlobals.context.sandbox;
	const webFrame = preloadGlobals.webFrame;
	const safeProcess = preloadGlobals.process;
	const configuration = parseWindowConfiguration();

	// Start to resolve process.env before anything gets load
	// so that we can run loading and resolving in parallel
	const whenEnvResolved = safeProcess.resolveEnv(configuration.userEnv);

	/**
	 * @param {string[]} modulePaths
	 * @param {(result, configuration: object) => any} resultCallback
	 * @param {{ forceEnableDeveloperKeybindings?: boolean, disallowReloadKeybinding?: boolean, removeDeveloperKeybindingsAfterLoad?: boolean, canModifyDOM?: (config: object) => void, beforeLoaderConfig?: (config: object, loaderConfig: object) => void, beforeRequire?: () => void }=} options
	 */
	function load(modulePaths, resultCallback, options) {

		// Apply zoom level early to avoid glitches
		const zoomLevel = configuration.zoomLevel;
		if (typeof zoomLevel === 'number' && zoomLevel !== 0) {
			webFrame.setZoomLevel(zoomLevel);
		}

		// Error handler
		safeProcess.on('uncaughtException', function (error) {
			onUnexpectedError(error, enableDeveloperTools);
		});

		// Developer tools
		const enableDeveloperTools = (safeProcess.env['VSCODE_DEV'] || !!configuration.extensionDevelopmentPath) && !configuration.extensionTestsPath;
		let developerToolsUnbind;
		if (enableDeveloperTools || (options && options.forceEnableDeveloperKeybindings)) {
			developerToolsUnbind = registerDeveloperKeybindings(options && options.disallowReloadKeybinding);
		}

		// Enable ASAR support
		globalThis.MonacoBootstrap.enableASARSupport(configuration.appRoot);

		if (options && typeof options.canModifyDOM === 'function') {
			options.canModifyDOM(configuration);
		}

		// Get the nls configuration into the process.env as early as possible
		const nlsConfig = globalThis.MonacoBootstrap.setupNLS();

		let locale = nlsConfig.availableLanguages['*'] || 'en';
		if (locale === 'zh-tw') {
			locale = 'zh-Hant';
		} else if (locale === 'zh-cn') {
			locale = 'zh-Hans';
		}

		window.document.documentElement.setAttribute('lang', locale);

		// do not advertise AMD to avoid confusing UMD modules loaded with nodejs (TODO@sandbox non-sandboxed only)
		if (!sandbox) {
			window['define'] = undefined;
		}

		// replace the patched electron fs with the original node fs for all AMD code (TODO@sandbox non-sandboxed only)
		if (!sandbox) {
			require.define('fs', ['original-fs'], function (originalFS) { return originalFS; });
		}

		window['MonacoEnvironment'] = {};

		// const baseUrl = sandbox ? // {{SQL CARBON EDIT}} Pending changes?
		// 	`${bootstrapLib.fileUriFromPath(configuration.appRoot, { isWindows: safeProcess.platform === 'win32', scheme: 'vscode-file', fallbackAuthority: 'vscode-app' })}/out` :
		// 	`${bootstrapLib.fileUriFromPath(configuration.appRoot, { isWindows: safeProcess.platform === 'win32' })}/out`;

		const loaderConfig = {
			baseUrl: `${uriFromPath(configuration.appRoot)}/out`,
			'vs/nls': nlsConfig,
			amdModulesPattern: /^(vs|sql)\//, // {{SQL CARBON EDIT}} include sql in regex
			preferScriptTags: sandbox
		};

		// cached data config
		if (configuration.nodeCachedDataDir) {
			loaderConfig.nodeCachedData = {
				path: configuration.nodeCachedDataDir,
				seed: modulePaths.join('')
			};
		}

		if (options && typeof options.beforeLoaderConfig === 'function') {
			options.beforeLoaderConfig(configuration, loaderConfig);
		}

		require.config(loaderConfig);

		if (nlsConfig.pseudo) {
			require(['vs/nls'], function (nlsPlugin) {
				nlsPlugin.setPseudoTranslation(nlsConfig.pseudo);
			});
		}

		if (options && typeof options.beforeRequire === 'function') {
			options.beforeRequire();
		}

		require(modulePaths, async result => {
			try {

				// Wait for process environment being fully resolved
				const perf = perfLib();
				perf.mark('willWaitForShellEnv');
				await whenEnvResolved;
				perf.mark('didWaitForShellEnv');

				// Callback only after process environment is resolved
				const callbackResult = resultCallback(result, configuration);
				if (callbackResult instanceof Promise) {
					await callbackResult;

					if (developerToolsUnbind && options && options.removeDeveloperKeybindingsAfterLoad) {
						developerToolsUnbind();
					}
				}
			} catch (error) {
				onUnexpectedError(error, enableDeveloperTools);
			}
		}, onUnexpectedError);
	}

	/**
	 * Parses the contents of the `INativeWindowConfiguration` that
	 * is passed into the URL from the `electron-main` side.
	 *
	 * @returns {{
	 * zoomLevel?: number,
	 * extensionDevelopmentPath?: string[],
	 * extensionTestsPath?: string,
	 * userEnv?: { [key: string]: string | undefined },
	 * appRoot: string,
	 * nodeCachedDataDir?: string
	 * }}
	 */
	function parseWindowConfiguration() {
		const rawConfiguration = (window.location.search || '').split(/[?&]/)
			.filter(function (param) { return !!param; })
			.map(function (param) { return param.split('='); })
			.filter(function (param) { return param.length === 2; })
			.reduce(function (r, param) { r[param[0]] = decodeURIComponent(param[1]); return r; }, {});

		return JSON.parse(rawConfiguration['config'] || '{}') || {};
	}

	/**
	 * @param {boolean | undefined} disallowReloadKeybinding
	 * @returns {() => void}
	 */
	function registerDeveloperKeybindings(disallowReloadKeybinding) {
		const ipcRenderer = preloadGlobals.ipcRenderer;

		const extractKey = function (e) {
			return [
				e.ctrlKey ? 'ctrl-' : '',
				e.metaKey ? 'meta-' : '',
				e.altKey ? 'alt-' : '',
				e.shiftKey ? 'shift-' : '',
				e.keyCode
			].join('');
		};

		// Devtools & reload support
		const TOGGLE_DEV_TOOLS_KB = (safeProcess.platform === 'darwin' ? 'meta-alt-73' : 'ctrl-shift-73'); // mac: Cmd-Alt-I, rest: Ctrl-Shift-I
		const TOGGLE_DEV_TOOLS_KB_ALT = '123'; // F12
		const RELOAD_KB = (safeProcess.platform === 'darwin' ? 'meta-82' : 'ctrl-82'); // mac: Cmd-R, rest: Ctrl-R

		/** @type {((e: any) => void) | undefined} */
		let listener = function (e) {
			const key = extractKey(e);
			if (key === TOGGLE_DEV_TOOLS_KB || key === TOGGLE_DEV_TOOLS_KB_ALT) {
				ipcRenderer.send('vscode:toggleDevTools');
			} else if (key === RELOAD_KB && !disallowReloadKeybinding) {
				ipcRenderer.send('vscode:reloadWindow');
			}
		};

		window.addEventListener('keydown', listener);

		return function () {
			if (listener) {
				window.removeEventListener('keydown', listener);
				listener = undefined;
			}
		};
	}

	/**
	 * @param {string | Error} error
	 * @param {boolean} [enableDeveloperTools]
	 */
	function onUnexpectedError(error, enableDeveloperTools) {
		if (enableDeveloperTools) {
			const ipcRenderer = preloadGlobals.ipcRenderer;
			ipcRenderer.send('vscode:openDevTools');
		}

		console.error(`[uncaught exception]: ${error}`);

		if (error && typeof error !== 'string' && error.stack) {
			console.error(error.stack);
		}
	}

	/**
	 * @return {typeof import('./vs/base/parts/sandbox/electron-sandbox/globals')}
	 */
	function globals() {
		// @ts-ignore (defined in globals.js)
		return window.vscode;
	}

	/**
	 * TODO@sandbox this should not use the file:// protocol at all
	 * and be consolidated with the fileUriFromPath() method in
	 * bootstrap.js.
	 *
	 * @param {string} path
	 * @returns {string}
	 */
	function uriFromPath(path) {
		let pathName = path.replace(/\\/g, '/');
		if (pathName.length > 0 && pathName.charAt(0) !== '/') {
			pathName = `/${pathName}`;
		}

		/** @type {string} */
		let uri;
		if (safeProcess.platform === 'win32' && pathName.startsWith('//')) { // specially handle Windows UNC paths
			uri = encodeURI(`file:${pathName}`);
		} else {
			uri = encodeURI(`file://${pathName}`);
		}

		return uri.replace(/#/g, '%23');
	}

	/**
	 * @return {{ mark: (name: string) => void }}
	 */
	function perfLib() {
		globalThis.MonacoPerformanceMarks = globalThis.MonacoPerformanceMarks || [];

		return {
			/**
			 * @param {string} name
			 */
			mark(name) {
				globalThis.MonacoPerformanceMarks.push(name, Date.now());
				performance.mark(name);
			}
		};
	}

	return {
		load,
		globals,
		perfLib
	};
}));
