/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface INativeCliOptions {
	'cli-data-dir'?: string;
	'disable-telemetry'?: boolean;
	'telemetry-level'?: string;
}

/**
 * A list of command line arguments we support natively.
 */
export interface NativeParsedArgs {
	// subcommands
	tunnel?: INativeCliOptions & {
		user: {
			login: {
				'access-token'?: string;
				'provider'?: string;
			};
		};
	};
	'serve-web'?: INativeCliOptions;
	/**
	 * {{ SQL CARBON EDIT}} Start
	 * Optional for Azure Data Studio to support URI conversion.
	 * Used to determine file paths to be opened with SQL Editor.
	 * If provided, we connect the given profile to it.
	 * More than one file can be passed to connect to provided profile.
	 */
	_?: string[];
	/**  {{ SQL CARBON EDIT}} End */
	'folder-uri'?: string[]; // undefined or array of 1 or more
	'file-uri'?: string[]; // undefined or array of 1 or more
	_urls?: string[];
	help?: boolean;
	version?: boolean;
	telemetry?: boolean;
	status?: boolean;
	wait?: boolean;
	waitMarkerFilePath?: string;
	diff?: boolean;
	merge?: boolean;
	add?: boolean;
	goto?: boolean;
	'new-window'?: boolean;
	'unity-launch'?: boolean; // Always open a new window, except if opening the first window or opening a file or folder as part of the launch.
	'reuse-window'?: boolean;
	locale?: string;
	'user-data-dir'?: string;
	'prof-startup'?: boolean;
	'prof-startup-prefix'?: string;
	'prof-append-timers'?: string;
	'prof-duration-markers'?: string[];
	'prof-duration-markers-file'?: string;
	'prof-v8-extensions'?: boolean;
	'no-cached-data'?: boolean;
	verbose?: boolean;
	trace?: boolean;
	'trace-category-filter'?: string;
	'trace-options'?: string;
	'open-devtools'?: boolean;
	log?: string[];
	logExtensionHostCommunication?: boolean;
	'extensions-dir'?: string;
	'extensions-download-dir'?: string;
	'builtin-extensions-dir'?: string;
	extensionDevelopmentPath?: string[]; // undefined or array of 1 or more local paths or URIs
	extensionTestsPath?: string; // either a local path or a URI
	extensionDevelopmentKind?: string[];
	extensionEnvironment?: string; // JSON-stringified Record<string, string> object
	'inspect-extensions'?: string;
	'inspect-brk-extensions'?: string;
	debugId?: string;
	debugRenderer?: boolean; // whether we expect a debugger (js-debug) to attach to the renderer, incl webviews+webworker
	'inspect-search'?: string;
	'inspect-brk-search'?: string;
	'inspect-ptyhost'?: string;
	'inspect-brk-ptyhost'?: string;
	'inspect-sharedprocess'?: string;
	'inspect-brk-sharedprocess'?: string;
	'disable-extensions'?: boolean;
	'disable-extension'?: string[]; // undefined or array of 1 or more
	'list-extensions'?: boolean;
	'show-versions'?: boolean;
	'category'?: string;
	'install-extension'?: string[]; // undefined or array of 1 or more
	'pre-release'?: boolean;
	'install-builtin-extension'?: string[]; // undefined or array of 1 or more
	'uninstall-extension'?: string[]; // undefined or array of 1 or more
	'locate-extension'?: string[]; // undefined or array of 1 or more
	'enable-proposed-api'?: string[]; // undefined or array of 1 or more
	'open-url'?: boolean;
	'skip-release-notes'?: boolean;
	'skip-welcome'?: boolean;
	'disable-telemetry'?: boolean;
	'export-default-configuration'?: string;
	'install-source'?: string;
	'disable-updates'?: boolean;
	'disable-keytar'?: boolean;
	'password-store'?: string;
	'disable-workspace-trust'?: boolean;
	'disable-crash-reporter'?: boolean;
	'crash-reporter-directory'?: string;
	'crash-reporter-id'?: string;
	'skip-add-to-recently-opened'?: boolean;
	'file-write'?: boolean;
	'file-chmod'?: boolean;
	'enable-smoke-test-driver'?: boolean;
	'remote'?: string;
	'force'?: boolean;
	'do-not-sync'?: boolean;
	'force-user-env'?: boolean;
	'force-disable-user-env'?: boolean;
	'sync'?: 'on' | 'off';
	'logsPath'?: string;
	'__enable-file-policy'?: boolean;
	editSessionId?: string;
	continueOn?: string;
	'locate-shell-integration-path'?: string;
	'profile'?: string;
	'profile-temp'?: boolean;
	'disable-chromium-sandbox'?: boolean;

	'enable-coi'?: boolean;

	// {{SQL CARBON EDIT}} Start
	/**
	 * Deprecated - used by SSMS - authenticationType should be used instead
	 */
	aad?: boolean;
	/**
	 * Supports providing applicationName that will be used for connection profile app name.
	 */
	applicationName?: string;
	/**
	 * Provide authenticationType to be used.
	 * accepted values: AzureMFA, SqlLogin, Integrated, etc.
	 */
	authenticationType?: string
	/**
	 * Operation to perform:
	 * accepted values: connect, openConnectionDialog
	 */
	command?: string;
	/**
	 *  Supports providing advanced connection properties that providers support.
	 *  Value must be a json object containing key-value pairs in format: '{"key1":"value1","key2":"value2",...}'
	 */
	connectionProperties?: string;
	/**
	 * Name of database
	 */
	database?: string;
	/**
	 * Deprecated - used by SSMS - authenticationType should be used instead.
	 */
	integrated?: boolean;
	/**
	 * Name of connection provider,
	 * accepted values: mssql (by default), pgsql, etc.
	 */
	provider?: string;
	/**
	 * Name of server
	 */
	server?: string;
	/**
	 * Whether or not to show dashboard
	 * accepted values: true, false (by default).
	 */
	showDashboard?: boolean;
	/**
	 * User name/email address
	 */
	user?: string;
	// {{SQL CARBON EDIT}} End

	// chromium command line args: https://electronjs.org/docs/all#supported-chrome-command-line-switches
	'no-proxy-server'?: boolean;
	'no-sandbox'?: boolean;
	'proxy-server'?: string;
	'proxy-bypass-list'?: string;
	'proxy-pac-url'?: string;
	'inspect'?: string;
	'inspect-brk'?: string;
	'js-flags'?: string;
	'disable-gpu'?: boolean;
	'disable-gpu-sandbox'?: boolean;
	'nolazy'?: boolean;
	'force-device-scale-factor'?: string;
	'force-renderer-accessibility'?: boolean;
	'ignore-certificate-errors'?: boolean;
	'allow-insecure-localhost'?: boolean;
	'log-net-log'?: string;
	'vmodule'?: string;
	'disable-dev-shm-usage'?: boolean;

	// MS Build command line arg
	'ms-enable-electron-run-as-node'?: boolean;
}
