/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface ParsedArgs {
	[arg: string]: any;
	_: string[];
	aad?: boolean;
	add?: boolean;
	database?:string;
	debugBrkPluginHost?: string;
	debugBrkSearch?: string;
	debugId?: string;
	debugPluginHost?: string;
	debugSearch?: string;
	diff?: boolean;
	'disable-crash-reporter'?: string;
	'disable-extension'?: string | string[];
	'disable-extensions'?: boolean;
	'disable-restore-windows'?: boolean;
	'disable-telemetry'?: boolean;
	'disable-updates'?: string;
	'driver'?: string;
	'enable-proposed-api'?: string | string[];
	'export-default-configuration'?: string;
	'extensions-dir'?: string;
	extensionDevelopmentPath?: string;
	extensionTestsPath?: string;
	'file-chmod'?: boolean;
	'file-write'?: boolean;
	'folder-uri'?: string | string[];
	goto?: boolean;
	help?: boolean;
	'install-extension'?: string | string[];
	'install-source'?: string;
	integrated?: boolean;
	'list-extensions'?: boolean;
	locale?: string;
	log?: string;
	logExtensionHostCommunication?: boolean;
	'max-memory'?: number;
	'new-window'?: boolean;
	'open-url'?: boolean;
	performance?: boolean;
	'prof-append-timers'?: string;
	'prof-startup'?: string;
	'prof-startup-prefix'?: string;
	'reuse-window'?: boolean;
	server?: string;
	'show-versions'?: boolean;
	'skip-add-to-recently-opened'?: boolean;
	'skip-getting-started'?: boolean;
	'skip-release-notes'?: boolean;
	status?: boolean;
	'sticky-quickopen'?: boolean;
	'uninstall-extension'?: string | string[];
	'unity-launch'?: boolean; // Always open a new window, except if opening the first window or opening a file or folder as part of the launch.
	'upload-logs'?: string;
	user?: string;
	'user-data-dir'?: string;
	_urls?: string[];
	verbose?: boolean;
	version?: boolean;
	wait?: boolean;
	waitMarkerFilePath?: string;
}

export const IEnvironmentService = createDecorator<IEnvironmentService>('environmentService');

export interface IDebugParams {
	port: number;
	break: boolean;
}

export interface IExtensionHostDebugParams extends IDebugParams {
	debugId: string;
}

export interface IEnvironmentService {
	_serviceBrand: any;

	args: ParsedArgs;

	execPath: string;
	cliPath: string;
	appRoot: string;

	userHome: string;
	userDataPath: string;

	appNameLong: string;
	appQuality: string;
	appSettingsHome: string;
	appSettingsPath: string;
	appKeybindingsPath: string;

	settingsSearchBuildId: number;
	settingsSearchUrl: string;

	backupHome: string;
	backupWorkspacesPath: string;

	workspacesHome: string;

	isExtensionDevelopment: boolean;
	disableExtensions: boolean | string[];
	extensionsPath: string;
	extensionDevelopmentPath: string;
	extensionTestsPath: string;

	debugExtensionHost: IExtensionHostDebugParams;
	debugSearch: IDebugParams;


	logExtensionHostCommunication: boolean;

	isBuilt: boolean;
	wait: boolean;
	status: boolean;
	performance: boolean;

	// logging
	log: string;
	logsPath: string;
	verbose: boolean;

	skipGettingStarted: boolean | undefined;
	skipReleaseNotes: boolean | undefined;

	skipAddToRecentlyOpened: boolean;

	mainIPCHandle: string;
	sharedIPCHandle: string;

	nodeCachedDataDir: string;

	installSourcePath: string;
	disableUpdates: boolean;
	disableCrashReporter: boolean;

	driverHandle: string;
	driverVerbose: boolean;
}
