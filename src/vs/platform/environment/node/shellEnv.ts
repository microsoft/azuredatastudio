/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { spawn } from 'child_process';
import { basename } from 'vs/base/common/path';
import { localize } from 'vs/nls';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { toErrorMessage } from 'vs/base/common/errorMessage';
import { canceled, isPromiseCanceledError } from 'vs/base/common/errors';
import { IProcessEnvironment, isWindows, OS } from 'vs/base/common/platform';
import { generateUuid } from 'vs/base/common/uuid';
import { getSystemShell } from 'vs/base/node/shell';
import { NativeParsedArgs } from 'vs/platform/environment/common/argv';
import { isLaunchedFromCli } from 'vs/platform/environment/node/argvHelper';
import { ILogService } from 'vs/platform/log/common/log';
import { Promises } from 'vs/base/common/async';

/**
 * The maximum of time we accept to wait on resolving the shell
 * environment before giving up. This ensures we are not blocking
 * other tasks from running for a too long time period.
 */
const MAX_SHELL_RESOLVE_TIME = 10000;

let unixShellEnvPromise: Promise<typeof process.env> | undefined = undefined;

/**
 * We need to get the environment from a user's shell.
 * This should only be done when Code itself is not launched
 * from within a shell.
 *
 * Will throw an error if:
 * - we hit a timeout of `MAX_SHELL_RESOLVE_TIME`
 * - any other error from spawning a shell to figure out the environment
 */
export async function resolveShellEnv(logService: ILogService, args: NativeParsedArgs, env: IProcessEnvironment): Promise<typeof process.env> {

	// Skip if --force-disable-user-env
	if (args['force-disable-user-env']) {
		logService.trace('resolveShellEnv(): skipped (--force-disable-user-env)');

		return {};
	}

	// Skip on windows
	else if (isWindows) {
		logService.trace('resolveShellEnv(): skipped (Windows)');

		return {};
	}

	// Skip if running from CLI already
	else if (isLaunchedFromCli(env) && !args['force-user-env']) {
		logService.trace('resolveShellEnv(): skipped (VSCODE_CLI is set)');

		return {};
	}

	// Otherwise resolve (macOS, Linux)
	else {
		if (isLaunchedFromCli(env)) {
			logService.trace('resolveShellEnv(): running (--force-user-env)');
		} else {
			logService.trace('resolveShellEnv(): running (macOS/Linux)');
		}

		// Call this only once and cache the promise for
		// subsequent calls since this operation can be
		// expensive (spawns a process).
		if (!unixShellEnvPromise) {
			unixShellEnvPromise = Promises.withAsyncBody<NodeJS.ProcessEnv>(async (resolve, reject) => {
				const cts = new CancellationTokenSource();

				// Give up resolving shell env after some time
				const timeout = setTimeout(() => {
					cts.dispose(true);
					reject(new Error(localize('resolveShellEnvTimeout', "Unable to resolve your shell environment in a reasonable time. Please review your shell configuration.")));
				}, MAX_SHELL_RESOLVE_TIME);

				// Resolve shell env and handle errors
				try {
					resolve(await doResolveUnixShellEnv(logService, cts.token));
				} catch (error) {
					if (!isPromiseCanceledError(error) && !cts.token.isCancellationRequested) {
						reject(new Error(localize('resolveShellEnvError', "Unable to resolve your shell environment: {0}", toErrorMessage(error))));
					} else {
						resolve({});
					}
				} finally {
					clearTimeout(timeout);
					cts.dispose();
				}
			});
		}

		return unixShellEnvPromise;
	}
}

async function doResolveUnixShellEnv(logService: ILogService, token: CancellationToken): Promise<typeof process.env> {
	const runAsNode = process.env['ELECTRON_RUN_AS_NODE'];
	logService.trace('getUnixShellEnvironment#runAsNode', runAsNode);

	const noAttach = process.env['ELECTRON_NO_ATTACH_CONSOLE'];
	logService.trace('getUnixShellEnvironment#noAttach', noAttach);

	const mark = generateUuid().replace(/-/g, '').substr(0, 12);
	const regex = new RegExp(mark + '(.*)' + mark);

	const env = {
		...process.env,
		ELECTRON_RUN_AS_NODE: '1',
		ELECTRON_NO_ATTACH_CONSOLE: '1'
	};

	logService.trace('getUnixShellEnvironment#env', env);
	const systemShellUnix = await getSystemShell(OS, env);
	logService.trace('getUnixShellEnvironment#shell', systemShellUnix);

	return new Promise<typeof process.env>((resolve, reject) => {
		if (token.isCancellationRequested) {
			return reject(canceled());
		}

		// handle popular non-POSIX shells
		const name = basename(systemShellUnix);
		let command: string, shellArgs: Array<string>;
		if (/^pwsh(-preview)?$/.test(name)) {
			// Older versions of PowerShell removes double quotes sometimes so we use "double single quotes" which is how
			// you escape single quotes inside of a single quoted string.
			command = `& '${process.execPath}' -p '''${mark}'' + JSON.stringify(process.env) + ''${mark}'''`;
			shellArgs = ['-Login', '-Command'];
		} else {
			command = `'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;

			if (name === 'tcsh') {
				shellArgs = ['-ic'];
			} else {
				shellArgs = ['-ilc'];
			}
		}

		logService.trace('getUnixShellEnvironment#spawn', JSON.stringify(shellArgs), command);

		const child = spawn(systemShellUnix, [...shellArgs, command], {
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe'],
			env
		});

		token.onCancellationRequested(() => {
			child.kill();

			return reject(canceled());
		});

		child.on('error', err => {
			logService.error('getUnixShellEnvironment#errorChildProcess', toErrorMessage(err));
			reject(err);
		});

		const buffers: Buffer[] = [];
		child.stdout.on('data', b => buffers.push(b));

		const stderr: Buffer[] = [];
		child.stderr.on('data', b => stderr.push(b));

		child.on('close', (code, signal) => {
			const raw = Buffer.concat(buffers).toString('utf8');
			logService.trace('getUnixShellEnvironment#raw', raw);

			const stderrStr = Buffer.concat(stderr).toString('utf8');
			if (stderrStr.trim()) {
				logService.trace('getUnixShellEnvironment#stderr', stderrStr);
			}

			if (code || signal) {
				return reject(new Error(localize('resolveShellEnvExitError', "Unexpected exit code from spawned shell (code {0}, signal {1})", code, signal)));
			}

			const match = regex.exec(raw);
			const rawStripped = match ? match[1] : '{}';

			try {
				const env = JSON.parse(rawStripped);

				if (runAsNode) {
					env['ELECTRON_RUN_AS_NODE'] = runAsNode;
				} else {
					delete env['ELECTRON_RUN_AS_NODE'];
				}

				if (noAttach) {
					env['ELECTRON_NO_ATTACH_CONSOLE'] = noAttach;
				} else {
					delete env['ELECTRON_NO_ATTACH_CONSOLE'];
				}

				// https://github.com/microsoft/vscode/issues/22593#issuecomment-336050758
				delete env['XDG_RUNTIME_DIR'];

				logService.trace('getUnixShellEnvironment#result', env);
				resolve(env);
			} catch (err) {
				logService.error('getUnixShellEnvironment#errorCaught', toErrorMessage(err));
				reject(err);
			}
		});
	});
}
