/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'child_process';
import * as platform from 'vs/base/common/platform';
import { getDriveLetter } from 'vs/base/common/extpath';
import { LinuxExternalTerminalService, MacExternalTerminalService, WindowsExternalTerminalService } from 'vs/platform/externalTerminal/node/externalTerminalService';
import { IExternalTerminalService } from 'vs/platform/externalTerminal/common/externalTerminal';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ExtHostConfigProvider } from 'vs/workbench/api/common/extHostConfiguration';



function spawnAsPromised(command: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		let stdout = '';
		const child = cp.spawn(command, args);
		if (child.pid) {
			child.stdout.on('data', (data: Buffer) => {
				stdout += data.toString();
			});
		}
		child.on('error', err => {
			reject(err);
		});
		child.on('close', code => {
			resolve(stdout);
		});
	});
}

let externalTerminalService: IExternalTerminalService | undefined = undefined;

export function runInExternalTerminal(args: DebugProtocol.RunInTerminalRequestArguments, configProvider: ExtHostConfigProvider): Promise<number | undefined> {
	if (!externalTerminalService) {
		if (platform.isWindows) {
			externalTerminalService = new WindowsExternalTerminalService(<IConfigurationService><unknown>undefined);
		} else if (platform.isMacintosh) {
			externalTerminalService = new MacExternalTerminalService(<IConfigurationService><unknown>undefined);
		} else if (platform.isLinux) {
			externalTerminalService = new LinuxExternalTerminalService(<IConfigurationService><unknown>undefined);
		} else {
			throw new Error('external terminals not supported on this platform');
		}
	}
	const config = configProvider.getConfiguration('terminal');
	return externalTerminalService.runInTerminal(args.title!, args.cwd, args.args, args.env || {}, config.external || {});
}

export function hasChildProcesses(processId: number | undefined): Promise<boolean> {
	if (processId) {

		// if shell has at least one child process, assume that shell is busy
		if (platform.isWindows) {
			return new Promise<boolean>(async (resolve) => {
				// See #123296
				const windowsProcessTree = await import('windows-process-tree');
				windowsProcessTree.getProcessTree(processId, (processTree) => {
					resolve(processTree.children.length > 0);
				});
			});
		} else {
			return spawnAsPromised('/usr/bin/pgrep', ['-lP', String(processId)]).then(stdout => {
				const r = stdout.trim();
				if (r.length === 0 || r.indexOf(' tmux') >= 0) { // ignore 'tmux'; see #43683
					return false;
				} else {
					return true;
				}
			}, error => {
				return true;
			});
		}
	}
	// fall back to safe side
	return Promise.resolve(true);
}

const enum ShellType { cmd, powershell, bash }


export function prepareCommand(shell: string, args: string[], cwd?: string, env?: { [key: string]: string | null; }): string {

	shell = shell.trim().toLowerCase();

	// try to determine the shell type
	let shellType;
	if (shell.indexOf('powershell') >= 0 || shell.indexOf('pwsh') >= 0) {
		shellType = ShellType.powershell;
	} else if (shell.indexOf('cmd.exe') >= 0) {
		shellType = ShellType.cmd;
	} else if (shell.indexOf('bash') >= 0) {
		shellType = ShellType.bash;
	} else if (platform.isWindows) {
		shellType = ShellType.cmd; // pick a good default for Windows
	} else {
		shellType = ShellType.bash;	// pick a good default for anything else
	}

	let quote: (s: string) => string;
	// begin command with a space to avoid polluting shell history
	let command = ' ';

	switch (shellType) {

		case ShellType.powershell:

			quote = (s: string) => {
				s = s.replace(/\'/g, '\'\'');
				if (s.length > 0 && s.charAt(s.length - 1) === '\\') {
					return `'${s}\\'`;
				}
				return `'${s}'`;
			};

			if (cwd) {
				const driveLetter = getDriveLetter(cwd);
				if (driveLetter) {
					command += `${driveLetter}:; `;
				}
				command += `cd ${quote(cwd)}; `;
			}
			if (env) {
				for (let key in env) {
					const value = env[key];
					if (value === null) {
						command += `Remove-Item env:${key}; `;
					} else {
						command += `\${env:${key}}='${value}'; `;
					}
				}
			}
			if (args.length > 0) {
				const cmd = quote(args.shift()!);
				command += (cmd[0] === '\'') ? `& ${cmd} ` : `${cmd} `;
				for (let a of args) {
					command += `${quote(a)} `;
				}
			}
			break;

		case ShellType.cmd:

			quote = (s: string) => {
				s = s.replace(/\"/g, '""');
				return (s.indexOf(' ') >= 0 || s.indexOf('"') >= 0 || s.length === 0) ? `"${s}"` : s;
			};

			if (cwd) {
				const driveLetter = getDriveLetter(cwd);
				if (driveLetter) {
					command += `${driveLetter}: && `;
				}
				command += `cd ${quote(cwd)} && `;
			}
			if (env) {
				command += 'cmd /C "';
				for (let key in env) {
					let value = env[key];
					if (value === null) {
						command += `set "${key}=" && `;
					} else {
						value = value.replace(/[\^\&\|\<\>]/g, s => `^${s}`);
						command += `set "${key}=${value}" && `;
					}
				}
			}
			for (let a of args) {
				command += `${quote(a)} `;
			}
			if (env) {
				command += '"';
			}
			break;

		case ShellType.bash:

			quote = (s: string) => {
				s = s.replace(/(["'\\\$])/g, '\\$1');
				return (s.indexOf(' ') >= 0 || s.indexOf(';') >= 0 || s.length === 0) ? `"${s}"` : s;
			};

			const hardQuote = (s: string) => {
				return /[^\w@%\/+=,.:^-]/.test(s) ? `'${s.replace(/'/g, '\'\\\'\'')}'` : s;
			};

			if (cwd) {
				command += `cd ${quote(cwd)} ; `;
			}
			if (env) {
				command += '/usr/bin/env';
				for (let key in env) {
					const value = env[key];
					if (value === null) {
						command += ` -u ${hardQuote(key)}`;
					} else {
						command += ` ${hardQuote(`${key}=${value}`)}`;
					}
				}
				command += ' ';
			}
			for (let a of args) {
				command += `${quote(a)} `;
			}
			break;
	}

	return command;
}
