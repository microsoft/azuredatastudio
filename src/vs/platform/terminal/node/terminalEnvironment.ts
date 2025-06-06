/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { FileAccess } from 'vs/base/common/network';
import { getCaseInsensitive } from 'vs/base/common/objects';
import * as path from 'vs/base/common/path';
import { IProcessEnvironment, isMacintosh, isWindows } from 'vs/base/common/platform';
import * as process from 'vs/base/common/process';
import { format } from 'vs/base/common/strings';
import { isString } from 'vs/base/common/types';
import * as pfs from 'vs/base/node/pfs';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { IShellLaunchConfig, ITerminalEnvironment, ITerminalProcessOptions } from 'vs/platform/terminal/common/terminal';
import { EnvironmentVariableMutatorType } from 'vs/platform/terminal/common/environmentVariable';
import { deserializeEnvironmentVariableCollections } from 'vs/platform/terminal/common/environmentVariableShared';
import { MergedEnvironmentVariableCollection } from 'vs/platform/terminal/common/environmentVariableCollection';
import { chmod, realpathSync } from 'fs';
import { promisify } from 'util';

export function getWindowsBuildNumber(): number {
	const osVersion = (/(\d+)\.(\d+)\.(\d+)/g).exec(os.release());
	let buildNumber: number = 0;
	if (osVersion && osVersion.length === 4) {
		buildNumber = parseInt(osVersion[3]);
	}
	return buildNumber;
}

export async function findExecutable(command: string, cwd?: string, paths?: string[], env: IProcessEnvironment = process.env as IProcessEnvironment, exists: (path: string) => Promise<boolean> = pfs.Promises.exists): Promise<string | undefined> {
	// If we have an absolute path then we take it.
	if (path.isAbsolute(command)) {
		return await exists(command) ? command : undefined;
	}
	if (cwd === undefined) {
		cwd = process.cwd();
	}
	const dir = path.dirname(command);
	if (dir !== '.') {
		// We have a directory and the directory is relative (see above). Make the path absolute
		// to the current working directory.
		const fullPath = path.join(cwd, command);
		return await exists(fullPath) ? fullPath : undefined;
	}
	const envPath = getCaseInsensitive(env, 'PATH');
	if (paths === undefined && isString(envPath)) {
		paths = envPath.split(path.delimiter);
	}
	// No PATH environment. Make path absolute to the cwd.
	if (paths === undefined || paths.length === 0) {
		const fullPath = path.join(cwd, command);
		return await exists(fullPath) ? fullPath : undefined;
	}
	// We have a simple file name. We get the path variable from the env
	// and try to find the executable on the path.
	for (const pathEntry of paths) {
		// The path entry is absolute.
		let fullPath: string;
		if (path.isAbsolute(pathEntry)) {
			fullPath = path.join(pathEntry, command);
		} else {
			fullPath = path.join(cwd, pathEntry, command);
		}

		if (await exists(fullPath)) {
			return fullPath;
		}
		if (isWindows) {
			let withExtension = fullPath + '.com';
			if (await exists(withExtension)) {
				return withExtension;
			}
			withExtension = fullPath + '.exe';
			if (await exists(withExtension)) {
				return withExtension;
			}
		}
	}
	const fullPath = path.join(cwd, command);
	return await exists(fullPath) ? fullPath : undefined;
}

export interface IShellIntegrationConfigInjection {
	/**
	 * A new set of arguments to use.
	 */
	newArgs: string[] | undefined;
	/**
	 * An optional environment to mixing to the real environment.
	 */
	envMixin?: IProcessEnvironment;
	/**
	 * An optional array of files to copy from `source` to `dest`.
	 */
	filesToCopy?: {
		source: string;
		dest: string;
	}[];
}

/**
 * For a given shell launch config, returns arguments to replace and an optional environment to
 * mixin to the SLC's environment to enable shell integration. This must be run within the context
 * that creates the process to ensure accuracy. Returns undefined if shell integration cannot be
 * enabled.
 */
export async function getShellIntegrationInjection(
	shellLaunchConfig: IShellLaunchConfig,
	options: ITerminalProcessOptions,
	env: ITerminalEnvironment | undefined,
	logService: ILogService,
	productService: IProductService,
	skipStickyBit: boolean = false
): Promise<IShellIntegrationConfigInjection | undefined> {
	// Shell integration arg injection is disabled when:
	// - The global setting is disabled
	// - There is no executable (not sure what script to run)
	// - The terminal is used by a feature like tasks or debugging
	const useWinpty = isWindows && (!options.windowsEnableConpty || getWindowsBuildNumber() < 18309);
	if (!options.shellIntegration.enabled || !shellLaunchConfig.executable || shellLaunchConfig.isFeatureTerminal || shellLaunchConfig.hideFromUser || shellLaunchConfig.ignoreShellIntegration || useWinpty) {
		return undefined;
	}

	const originalArgs = shellLaunchConfig.args;
	const shell = process.platform === 'win32' ? path.basename(shellLaunchConfig.executable).toLowerCase() : path.basename(shellLaunchConfig.executable);
	const appRoot = path.dirname(FileAccess.asFileUri('').fsPath);
	let newArgs: string[] | undefined;
	const envMixin: IProcessEnvironment = {
		'VSCODE_INJECTION': '1'
	};

	if (options.shellIntegration.nonce) {
		envMixin['VSCODE_NONCE'] = options.shellIntegration.nonce;
	}

	// Windows
	if (isWindows) {
		if (shell === 'pwsh.exe' || shell === 'powershell.exe') {
			if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.WindowsPwsh);
			} else if (arePwshLoginArgs(originalArgs)) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.WindowsPwshLogin);
			}
			if (!newArgs) {
				return undefined;
			}
			newArgs = [...newArgs]; // Shallow clone the array to avoid setting the default array
			newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot, '');
			// TODO: Uncomment when suggestEnabled is ready for use
			// if (options.shellIntegration.suggestEnabled) {
			// 	envMixin['VSCODE_SUGGEST'] = '1';
			// }
			return { newArgs, envMixin };
		}
		logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
		return undefined;
	}

	// Linux & macOS
	switch (shell) {
		case 'bash': {
			if (!originalArgs || originalArgs.length === 0) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.Bash);
			} else if (areZshBashLoginArgs(originalArgs)) {
				envMixin['VSCODE_SHELL_LOGIN'] = '1';
				addEnvMixinPathPrefix(options, envMixin);
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.Bash);
			}
			if (!newArgs) {
				return undefined;
			}
			newArgs = [...newArgs]; // Shallow clone the array to avoid setting the default array
			newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);
			return { newArgs, envMixin };
		}
		case 'fish': {
			// The injection mechanism used for fish is to add a custom dir to $XDG_DATA_DIRS which
			// is similar to $ZDOTDIR in zsh but contains a list of directories to run from.
			// const oldDataDirs = env?.XDG_DATA_DIRS ?? '/usr/local/share:/usr/share';
			// const newDataDir = path.join(appRoot, 'out/vs/workbench/contrib/terminal/browser/media/fish_xdg_data');
			// envMixin['XDG_DATA_DIRS'] = `${oldDataDirs}:${newDataDir}`;
			// addEnvMixinPathPrefix(options, envMixin);
			// return { newArgs: undefined, envMixin };
			return undefined;
		}
		case 'pwsh': {
			if (!originalArgs || arePwshImpliedArgs(originalArgs)) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.Pwsh);
			} else if (arePwshLoginArgs(originalArgs)) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.PwshLogin);
			}
			if (!newArgs) {
				return undefined;
			}
			// TODO: Uncomment when suggestEnabled is ready for use
			// if (options.shellIntegration.suggestEnabled) {
			// 	envMixin['VSCODE_SUGGEST'] = '1';
			// }
			newArgs = [...newArgs]; // Shallow clone the array to avoid setting the default array
			newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot, '');
			return { newArgs, envMixin };
		}
		case 'zsh': {
			if (!originalArgs || originalArgs.length === 0) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.Zsh);
			} else if (areZshBashLoginArgs(originalArgs)) {
				newArgs = shellIntegrationArgs.get(ShellIntegrationExecutable.ZshLogin);
				addEnvMixinPathPrefix(options, envMixin);
			} else if (originalArgs === shellIntegrationArgs.get(ShellIntegrationExecutable.Zsh) || originalArgs === shellIntegrationArgs.get(ShellIntegrationExecutable.ZshLogin)) {
				newArgs = originalArgs;
			}
			if (!newArgs) {
				return undefined;
			}
			newArgs = [...newArgs]; // Shallow clone the array to avoid setting the default array
			newArgs[newArgs.length - 1] = format(newArgs[newArgs.length - 1], appRoot);

			// Move .zshrc into $ZDOTDIR as the way to activate the script
			let username: string;
			try {
				username = os.userInfo().username;
			} catch {
				username = 'unknown';
			}
			const realTmpDir = realpathSync(os.tmpdir());
			const zdotdir = path.join(realTmpDir, `${username}-${productService.applicationName}-zsh`);
			if (!skipStickyBit) {
				try {
					const chmodAsync = promisify(chmod);
					await chmodAsync(zdotdir, 0o1700);
				} catch (err) {
					logService.error(`Failed to set sticky bit on ${zdotdir}: ${err}`);
					return undefined;
				}
			}
			envMixin['ZDOTDIR'] = zdotdir;
			const userZdotdir = env?.ZDOTDIR ?? os.homedir() ?? `~`;
			envMixin['USER_ZDOTDIR'] = userZdotdir;
			const filesToCopy: IShellIntegrationConfigInjection['filesToCopy'] = [];
			filesToCopy.push({
				source: path.join(appRoot, 'out/vs/workbench/contrib/terminal/browser/media/shellIntegration-rc.zsh'),
				dest: path.join(zdotdir, '.zshrc')
			});
			filesToCopy.push({
				source: path.join(appRoot, 'out/vs/workbench/contrib/terminal/browser/media/shellIntegration-profile.zsh'),
				dest: path.join(zdotdir, '.zprofile')
			});
			filesToCopy.push({
				source: path.join(appRoot, 'out/vs/workbench/contrib/terminal/browser/media/shellIntegration-env.zsh'),
				dest: path.join(zdotdir, '.zshenv')
			});
			filesToCopy.push({
				source: path.join(appRoot, 'out/vs/workbench/contrib/terminal/browser/media/shellIntegration-login.zsh'),
				dest: path.join(zdotdir, '.zlogin')
			});
			return { newArgs, envMixin, filesToCopy };
		}
	}
	logService.warn(`Shell integration cannot be enabled for executable "${shellLaunchConfig.executable}" and args`, shellLaunchConfig.args);
	return undefined;
}

/**
 * On macOS the profile calls path_helper which adds a bunch of standard bin directories to the
 * beginning of the PATH. This causes significant problems for the environment variable
 * collection API as the custom paths added to the end will now be somewhere in the middle of
 * the PATH. To combat this, VSCODE_PATH_PREFIX is used to re-apply any prefix after the profile
 * has run. This will cause duplication in the PATH but should fix the issue.
 *
 * See #99878 for more information.
 */
function addEnvMixinPathPrefix(options: ITerminalProcessOptions, envMixin: IProcessEnvironment): void {
	if (isMacintosh && options.environmentVariableCollections) {
		// Deserialize and merge
		const deserialized = deserializeEnvironmentVariableCollections(options.environmentVariableCollections);
		const merged = new MergedEnvironmentVariableCollection(deserialized);

		// Get all prepend PATH entries
		const pathEntry = merged.getVariableMap({ workspaceFolder: options.workspaceFolder }).get('PATH');
		const prependToPath: string[] = [];
		if (pathEntry) {
			for (const mutator of pathEntry) {
				if (mutator.type === EnvironmentVariableMutatorType.Prepend) {
					prependToPath.push(mutator.value);
				}
			}
		}

		// Add to the environment mixin to be applied in the shell integration script
		if (prependToPath.length > 0) {
			envMixin['VSCODE_PATH_PREFIX'] = prependToPath.join('');
		}
	}
}

enum ShellIntegrationExecutable {
	WindowsPwsh = 'windows-pwsh',
	WindowsPwshLogin = 'windows-pwsh-login',
	Pwsh = 'pwsh',
	PwshLogin = 'pwsh-login',
	Zsh = 'zsh',
	ZshLogin = 'zsh-login',
	Bash = 'bash'
}

const shellIntegrationArgs: Map<ShellIntegrationExecutable, string[]> = new Map();
// The try catch swallows execution policy errors in the case of the archive distributable
shellIntegrationArgs.set(ShellIntegrationExecutable.WindowsPwsh, ['-noexit', '-command', 'try { . \"{0}\\out\\vs\\workbench\\contrib\\terminal\\browser\\media\\shellIntegration.ps1\" } catch {}{1}']);
shellIntegrationArgs.set(ShellIntegrationExecutable.WindowsPwshLogin, ['-l', '-noexit', '-command', 'try { . \"{0}\\out\\vs\\workbench\\contrib\\terminal\\browser\\media\\shellIntegration.ps1\" } catch {}{1}']);
shellIntegrationArgs.set(ShellIntegrationExecutable.Pwsh, ['-noexit', '-command', '. "{0}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration.ps1"{1}']);
shellIntegrationArgs.set(ShellIntegrationExecutable.PwshLogin, ['-l', '-noexit', '-command', '. "{0}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration.ps1"']);
shellIntegrationArgs.set(ShellIntegrationExecutable.Zsh, ['-i']);
shellIntegrationArgs.set(ShellIntegrationExecutable.ZshLogin, ['-il']);
shellIntegrationArgs.set(ShellIntegrationExecutable.Bash, ['--init-file', '{0}/out/vs/workbench/contrib/terminal/browser/media/shellIntegration-bash.sh']);
const loginArgs = ['-login', '-l'];
const pwshImpliedArgs = ['-nol', '-nologo'];

function arePwshLoginArgs(originalArgs: string | string[]): boolean {
	if (typeof originalArgs === 'string') {
		return loginArgs.includes(originalArgs.toLowerCase());
	} else {
		return originalArgs.length === 1 && loginArgs.includes(originalArgs[0].toLowerCase()) ||
			(originalArgs.length === 2 &&
				(((loginArgs.includes(originalArgs[0].toLowerCase())) || loginArgs.includes(originalArgs[1].toLowerCase())))
				&& ((pwshImpliedArgs.includes(originalArgs[0].toLowerCase())) || pwshImpliedArgs.includes(originalArgs[1].toLowerCase())));
	}
}

function arePwshImpliedArgs(originalArgs: string | string[]): boolean {
	if (typeof originalArgs === 'string') {
		return pwshImpliedArgs.includes(originalArgs.toLowerCase());
	} else {
		return originalArgs.length === 0 || originalArgs?.length === 1 && pwshImpliedArgs.includes(originalArgs[0].toLowerCase());
	}
}

function areZshBashLoginArgs(originalArgs: string | string[]): boolean {
	return originalArgs === 'string' && loginArgs.includes(originalArgs.toLowerCase())
		|| typeof originalArgs !== 'string' && originalArgs.length === 1 && loginArgs.includes(originalArgs[0].toLowerCase());
}
