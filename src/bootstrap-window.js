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
	const bootstrapLib = bootstrap();
	const preloadGlobals = sandboxGlobals();
	const safeProcess = preloadGlobals.process;

	/**
	 * @typedef {import('./vs/base/parts/sandbox/common/sandboxTypes').ISandboxConfiguration} ISandboxConfiguration
	 *
	 * @param {string[]} modulePaths
	 * @param {(result: unknown, configuration: ISandboxConfiguration) => Promise<unknown> | undefined} resultCallback
	 * @param {{
	 *  configureDeveloperSettings?: (config: ISandboxConfiguration) => {
	 * 		forceDisableShowDevtoolsOnError?: boolean,
	 * 		forceEnableDeveloperKeybindings?: boolean,
	 * 		disallowReloadKeybinding?: boolean,
	 * 		removeDeveloperKeybindingsAfterLoad?: boolean
	 * 	},
	 * 	canModifyDOM?: (config: ISandboxConfiguration) => void,
	 * 	beforeLoaderConfig?: (loaderConfig: object) => void,
	 *  beforeRequire?: () => void
	 * }} [options]
	 */
	async function load(modulePaths, resultCallback, options) {

		const isDev = !!safeProcess.env['VSCODE_DEV'];

		// Error handler (TODO@sandbox non-sandboxed only)
		let showDevtoolsOnError = isDev;
		safeProcess.on('uncaughtException', function (/** @type {string | Error} */ error) {
			onUnexpectedError(error, showDevtoolsOnError);
		});

		// Await window configuration from preload
		const timeout = setTimeout(() => { console.error(`[resolve window config] Could not resolve window configuration within 10 seconds, but will continue to wait...`); }, 10000);
		performance.mark('code/willWaitForWindowConfig');
		/** @type {ISandboxConfiguration} */
		const configuration = await preloadGlobals.context.resolveConfiguration();
		performance.mark('code/didWaitForWindowConfig');
		clearTimeout(timeout);

		// Signal DOM modifications are now OK
		if (typeof options?.canModifyDOM === 'function') {
			options.canModifyDOM(configuration);
		}

		// Developer settings
		const {
			forceDisableShowDevtoolsOnError,
			forceEnableDeveloperKeybindings,
			disallowReloadKeybinding,
			removeDeveloperKeybindingsAfterLoad
		} = typeof options?.configureDeveloperSettings === 'function' ? options.configureDeveloperSettings(configuration) : {
			forceDisableShowDevtoolsOnError: false,
			forceEnableDeveloperKeybindings: false,
			disallowReloadKeybinding: false,
			removeDeveloperKeybindingsAfterLoad: false
		};
		showDevtoolsOnError = isDev && !forceDisableShowDevtoolsOnError;
		const enableDeveloperKeybindings = isDev || forceEnableDeveloperKeybindings;
		let developerDeveloperKeybindingsDisposable;
		if (enableDeveloperKeybindings) {
			developerDeveloperKeybindingsDisposable = registerDeveloperKeybindings(disallowReloadKeybinding);
		}

		// Enable ASAR support (TODO@sandbox non-sandboxed only)
		if (!safeProcess.sandboxed) {
			globalThis.MonacoBootstrap.enableASARSupport(configuration.appRoot);
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

		// Replace the patched electron fs with the original node fs for all AMD code (TODO@sandbox non-sandboxed only)
		if (!safeProcess.sandboxed) {
			require.define('fs', [], function () { return require.__$__nodeRequire('original-fs'); });
		}

		window['MonacoEnvironment'] = {};

		const loaderConfig = {
			baseUrl: `${bootstrapLib.fileUriFromPath(configuration.appRoot, { isWindows: safeProcess.platform === 'win32', scheme: 'vscode-file', fallbackAuthority: 'vscode-app' })}/out`,
			'vs/nls': nlsConfig,
			preferScriptTags: true
		};

		// use a trusted types policy when loading via script tags
		if (loaderConfig.preferScriptTags) {
			loaderConfig.trustedTypesPolicy = window.trustedTypes?.createPolicy('amdLoader', {
				createScriptURL(value) {
					if (value.startsWith(window.location.origin)) {
						return value;
					}
					throw new Error(`Invalid script url: ${value}`);
				}
			});
		}

		// Teach the loader the location of the node modules we use in renderers
		// This will enable to load these modules via <script> tags instead of
		// using a fallback such as node.js require which does not exist in sandbox
		const baseNodeModulesPath = isDev ? '../node_modules' : '../node_modules.asar';
		loaderConfig.paths = {
			'vscode-textmate': `${baseNodeModulesPath}/vscode-textmate/release/main.js`,
			'vscode-oniguruma': `${baseNodeModulesPath}/vscode-oniguruma/release/main.js`,
			'xterm': `${baseNodeModulesPath}/xterm/lib/xterm.js`,
			'xterm-addon-search': `${baseNodeModulesPath}/xterm-addon-search/lib/xterm-addon-search.js`,
			'xterm-addon-unicode11': `${baseNodeModulesPath}/xterm-addon-unicode11/lib/xterm-addon-unicode11.js`,
			'xterm-addon-webgl': `${baseNodeModulesPath}/xterm-addon-webgl/lib/xterm-addon-webgl.js`,
			'iconv-lite-umd': `${baseNodeModulesPath}/iconv-lite-umd/lib/iconv-lite-umd.js`,
			'jschardet': `${baseNodeModulesPath}/jschardet/dist/jschardet.min.js`,
			'@vscode/vscode-languagedetection': `${baseNodeModulesPath}/@vscode/vscode-languagedetection/dist/lib/index.js`,
			'tas-client-umd': `${baseNodeModulesPath}/tas-client-umd/lib/tas-client-umd.js`,
			'ansi_up': `${baseNodeModulesPath}/ansi_up/ansi_up.js`
		};

		// For priviledged renderers, allow to load built-in and other node.js
		// modules via AMD which has a fallback to using node.js `require`
		if (!safeProcess.sandboxed) {
			// VS Code uses an AMD loader for its own files (and ours) but Node.JS normally uses commonjs. For modules that
			// support UMD this may cause some issues since it will appear to them that AMD exists and so depending on the order
			// they check support for the two types they may end up using either commonjs or AMD. If commonjs is first this is
			// the expected method and so nothing needs to be done - but if it's AMD then the VS Code loader will throw an error
			// (Can only have one anonymous define call per script file). In order to make packages that do this load correctly
			// we need to add them to the list below to tell the loader that these should be loaded using AMD as well
			loaderConfig.amdModulesPattern = /(vs|sql)\/|(^vscode-textmate$)|(^vscode-oniguruma$)|(^xterm$)|(^xterm-addon-search$)|(^xterm-addon-unicode11$)|(^xterm-addon-webgl$)|(^iconv-lite-umd$)|(^jschardet$)|(^@vscode\/vscode-languagedetection$)|(^tas-client-umd$)|(^ansi_up$)/;  // {{SQL CARBON EDIT}} include sql and ansi_up in regex
		}

		// Signal before require.config()
		if (typeof options?.beforeLoaderConfig === 'function') {
			options.beforeLoaderConfig(loaderConfig);
		}

		// Configure loader
		require.config(loaderConfig);

		// Handle pseudo NLS
		if (nlsConfig.pseudo) {
			require(['vs/nls'], function (nlsPlugin) {
				nlsPlugin.setPseudoTranslation(nlsConfig.pseudo);
			});
		}

		// Signal before require()
		if (typeof options?.beforeRequire === 'function') {
			options.beforeRequire();
		}

		// Actually require the main module as specified
		require(modulePaths, async result => {
			try {

				// Callback only after process environment is resolved
				const callbackResult = resultCallback(result, configuration);
				if (callbackResult instanceof Promise) {
					await callbackResult;

					if (developerDeveloperKeybindingsDisposable && removeDeveloperKeybindingsAfterLoad) {
						developerDeveloperKeybindingsDisposable();
					}
				}
			} catch (error) {
				onUnexpectedError(error, enableDeveloperKeybindings);
			}
		}, onUnexpectedError);
	}

	/**
	 * @param {boolean | undefined} disallowReloadKeybinding
	 * @returns {() => void}
	 */
	function registerDeveloperKeybindings(disallowReloadKeybinding) {
		const ipcRenderer = preloadGlobals.ipcRenderer;

		const extractKey =
			/**
			 * @param {KeyboardEvent} e
			 */
			function (e) {
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

		/** @type {((e: KeyboardEvent) => void) | undefined} */
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
	 * @param {boolean} [showDevtoolsOnError]
	 */
	function onUnexpectedError(error, showDevtoolsOnError) {
		if (showDevtoolsOnError) {
			const ipcRenderer = preloadGlobals.ipcRenderer;
			ipcRenderer.send('vscode:openDevTools');
		}

		console.error(`[uncaught exception]: ${error}`);

		if (error && typeof error !== 'string' && error.stack) {
			console.error(error.stack);
		}
	}

	/**
	 * @return {{ fileUriFromPath: (path: string, config: { isWindows?: boolean, scheme?: string, fallbackAuthority?: string }) => string; }}
	 */
	function bootstrap() {
		// @ts-ignore (defined in bootstrap.js)
		return window.MonacoBootstrap;
	}

	/**
	 * @return {typeof import('./vs/base/parts/sandbox/electron-sandbox/globals')}
	 */
	function sandboxGlobals() {
		// @ts-ignore (defined in globals.js)
		return window.vscode;
	}

	return {
		load
	};
}));
