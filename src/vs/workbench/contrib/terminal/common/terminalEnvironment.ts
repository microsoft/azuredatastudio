/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'vs/base/common/path';
import * as platform from 'vs/base/common/platform';
import { URI as Uri } from 'vs/base/common/uri';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { IShellLaunchConfig, ITerminalEnvironment } from 'vs/workbench/contrib/terminal/common/terminal';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';

/**
 * This module contains utility functions related to the environment, cwd and paths.
 */

export function mergeEnvironments(parent: platform.IProcessEnvironment, other: ITerminalEnvironment | undefined): void {
	if (!other) {
		return;
	}

	// On Windows apply the new values ignoring case, while still retaining
	// the case of the original key.
	if (platform.isWindows) {
		for (const configKey in other) {
			let actualKey = configKey;
			for (const envKey in parent) {
				if (configKey.toLowerCase() === envKey.toLowerCase()) {
					actualKey = envKey;
					break;
				}
			}
			const value = other[configKey];
			_mergeEnvironmentValue(parent, actualKey, value);
		}
	} else {
		Object.keys(other).forEach((key) => {
			const value = other[key];
			_mergeEnvironmentValue(parent, key, value);
		});
	}
}

function _mergeEnvironmentValue(env: ITerminalEnvironment, key: string, value: string | null): void {
	if (typeof value === 'string') {
		env[key] = value;
	} else {
		delete env[key];
	}
}

export function addTerminalEnvironmentKeys(env: platform.IProcessEnvironment, version: string | undefined, locale: string | undefined, setLocaleVariables: boolean): void {
	env['TERM_PROGRAM'] = 'vscode';
	if (version) {
		env['TERM_PROGRAM_VERSION'] = version;
	}
	if (setLocaleVariables) {
		env['LANG'] = _getLangEnvVariable(locale);
	}
}

export function mergeNonNullKeys(env: platform.IProcessEnvironment, other: ITerminalEnvironment | NodeJS.ProcessEnv | undefined) {
	if (!other) {
		return;
	}
	for (const key of Object.keys(other)) {
		const value = other[key];
		if (value) {
			env[key] = value;
		}
	}
}

export function resolveConfigurationVariables(configurationResolverService: IConfigurationResolverService, env: ITerminalEnvironment, lastActiveWorkspaceRoot: IWorkspaceFolder | null): ITerminalEnvironment {
	Object.keys(env).forEach((key) => {
		const value = env[key];
		if (typeof value === 'string' && lastActiveWorkspaceRoot !== null) {
			env[key] = configurationResolverService.resolve(lastActiveWorkspaceRoot, value);
		}
	});
	return env;
}

function _getLangEnvVariable(locale?: string) {
	const parts = locale ? locale.split('-') : [];
	const n = parts.length;
	if (n === 0) {
		// Fallback to en_US to prevent possible encoding issues.
		return 'en_US.UTF-8';
	}
	if (n === 1) {
		// app.getLocale can return just a language without a variant, fill in the variant for
		// supported languages as many shells expect a 2-part locale.
		const languageVariants = {
			de: 'DE',
			en: 'US',
			es: 'ES',
			fi: 'FI',
			fr: 'FR',
			it: 'IT',
			ja: 'JP',
			ko: 'KR',
			pl: 'PL',
			ru: 'RU',
			zh: 'CN'
		};
		if (parts[0] in languageVariants) {
			parts.push(languageVariants[parts[0]]);
		}
	} else {
		// Ensure the variant is uppercase
		parts[1] = parts[1].toUpperCase();
	}
	return parts.join('_') + '.UTF-8';
}

export function getCwd(shell: IShellLaunchConfig, userHome: string, root?: Uri, customCwd?: string): string {
	if (shell.cwd) {
		return (typeof shell.cwd === 'object') ? shell.cwd.fsPath : shell.cwd;
	}

	let cwd: string | undefined;

	// TODO: Handle non-existent customCwd
	if (!shell.ignoreConfigurationCwd && customCwd) {
		if (path.isAbsolute(customCwd)) {
			cwd = customCwd;
		} else if (root) {
			cwd = path.join(root.fsPath, customCwd);
		}
	}

	// If there was no custom cwd or it was relative with no workspace
	if (!cwd) {
		cwd = root ? root.fsPath : userHome;
	}

	return _sanitizeCwd(cwd);
}

function _sanitizeCwd(cwd: string): string {
	// Make the drive letter uppercase on Windows (see #9448)
	if (platform.platform === platform.Platform.Windows && cwd && cwd[1] === ':') {
		return cwd[0].toUpperCase() + cwd.substr(1);
	}
	return cwd;
}

export function escapeNonWindowsPath(path: string): string {
	let newPath = path;
	if (newPath.indexOf('\\') !== 0) {
		newPath = newPath.replace(/\\/g, '\\\\');
	}
	if (!newPath && (newPath.indexOf('"') !== -1)) {
		newPath = '\'' + newPath + '\'';
	} else if (newPath.indexOf(' ') !== -1) {
		newPath = newPath.replace(/ /g, '\\ ');
	}
	return newPath;
}

export function mergeDefaultShellPathAndArgs(
	shell: IShellLaunchConfig,
	fetchSetting: (key: string) => { user: string | string[] | undefined, value: string | string[] | undefined, default: string | string[] | undefined },
	isWorkspaceShellAllowed: boolean,
	platformOverride: platform.Platform = platform.platform
): void {
	const platformKey = platformOverride === platform.Platform.Windows ? 'windows' : platformOverride === platform.Platform.Mac ? 'osx' : 'linux';
	const shellConfigValue = fetchSetting(`terminal.integrated.shell.${platformKey}`);
	// const shellConfigValue = this._workspaceConfigurationService.inspect<string>(`terminal.integrated.shell.${platformKey}`);
	const shellArgsConfigValue = fetchSetting(`terminal.integrated.shellArgs.${platformKey}`);
	// const shellArgsConfigValue = this._workspaceConfigurationService.inspect<string[]>(`terminal.integrated.shellArgs.${platformKey}`);

	shell.executable = (isWorkspaceShellAllowed ? <string>shellConfigValue.value : <string>shellConfigValue.user) || <string>shellConfigValue.default;
	shell.args = (isWorkspaceShellAllowed ? <string[]>shellArgsConfigValue.value : <string[]>shellArgsConfigValue.user) || <string[]>shellArgsConfigValue.default;

	// Change Sysnative to System32 if the OS is Windows but NOT WoW64. It's
	// safe to assume that this was used by accident as Sysnative does not
	// exist and will break the terminal in non-WoW64 environments.
	if ((platformOverride === platform.Platform.Windows) && !process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432') && process.env.windir) {
		const sysnativePath = path.join(process.env.windir, 'Sysnative').toLowerCase();
		if (shell.executable && shell.executable.toLowerCase().indexOf(sysnativePath) === 0) {
			shell.executable = path.join(process.env.windir, 'System32', shell.executable.substr(sysnativePath.length));
		}
	}

	// Convert / to \ on Windows for convenience
	if (shell.executable && platformOverride === platform.Platform.Windows) {
		shell.executable = shell.executable.replace(/\//g, '\\');
	}
}
