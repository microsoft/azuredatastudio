/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as fs from 'fs';
import { IProcessEnvironment, isLinux, isMacintosh, isWindows, Platform } from 'vs/base/common/platform';
import { SymlinkSupport } from 'vs/base/node/pfs';
import { LinuxDistro } from 'vs/workbench/contrib/terminal/common/terminal';
import * as processes from 'vs/base/node/processes'; // {{SQL CARBON EDIT}} - Add back getSystemShell for web build

export function getSystemShell(p: Platform, environment: IProcessEnvironment = process.env as IProcessEnvironment): string { // {{SQL CARBON EDIT}} - Add back getSystemShell for web build
	if (p === Platform.Windows) {
		if (isWindows) {
			return getSystemShellWindows(environment);
		}
		// Don't detect Windows shell when not on Windows
		return processes.getWindowsShell(environment);
	}
	// Only use $SHELL for the current OS
	if (isLinux && p === Platform.Mac || isMacintosh && p === Platform.Linux) {
		return '/bin/bash';
	}
	return getSystemShellUnixLike(environment);
}

let _TERMINAL_DEFAULT_SHELL_UNIX_LIKE: string | null = null; // {{SQL CARBON EDIT}} - Add back getSystemShell for web build
function getSystemShellUnixLike(environment: IProcessEnvironment): string {
	if (!_TERMINAL_DEFAULT_SHELL_UNIX_LIKE) {
		let unixLikeTerminal = 'sh';
		if (!isWindows && environment.SHELL) {
			unixLikeTerminal = environment.SHELL;
			// Some systems have $SHELL set to /bin/false which breaks the terminal
			if (unixLikeTerminal === '/bin/false') {
				unixLikeTerminal = '/bin/bash';
			}
		}
		if (isWindows) {
			unixLikeTerminal = '/bin/bash'; // for WSL
		}
		_TERMINAL_DEFAULT_SHELL_UNIX_LIKE = unixLikeTerminal;
	}
	return _TERMINAL_DEFAULT_SHELL_UNIX_LIKE;
}

let _TERMINAL_DEFAULT_SHELL_WINDOWS: string | null = null;
function getSystemShellWindows(environment: IProcessEnvironment): string {
	if (!_TERMINAL_DEFAULT_SHELL_WINDOWS) {
		const isAtLeastWindows10 = isWindows && parseFloat(os.release()) >= 10;
		const is32ProcessOn64Windows = environment.hasOwnProperty('PROCESSOR_ARCHITEW6432');
		const powerShellPath = `${environment.windir}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}\\WindowsPowerShell\\v1.0\\powershell.exe`;
		_TERMINAL_DEFAULT_SHELL_WINDOWS = isAtLeastWindows10 ? powerShellPath : processes.getWindowsShell(environment);
	}
	return _TERMINAL_DEFAULT_SHELL_WINDOWS;
}

let detectedDistro = LinuxDistro.Unknown;
if (isLinux) {
	const file = '/etc/os-release';
	SymlinkSupport.existsFile(file).then(async exists => {
		if (!exists) {
			return;
		}
		const buffer = await fs.promises.readFile(file);
		const contents = buffer.toString();
		if (/NAME="?Fedora"?/.test(contents)) {
			detectedDistro = LinuxDistro.Fedora;
		} else if (/NAME="?Ubuntu"?/.test(contents)) {
			detectedDistro = LinuxDistro.Ubuntu;
		}
	});
}

export const linuxDistro = detectedDistro;
