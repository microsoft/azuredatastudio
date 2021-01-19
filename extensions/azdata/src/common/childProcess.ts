/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AdditionalEnvVars } from 'azdata-ext';
import * as cp from 'child_process';
import * as sudo from 'sudo-prompt';
import * as loc from '../localizedConstants';
import Logger from './logger';

/**
 * Wrapper error for when an unexpected exit code was received
 */
export class ExitCodeError extends Error {
	constructor(private _code: number, private _stderr: string) {
		super();
		this.setMessage();
	}

	public get code(): number {
		return this._code;
	}

	public set code(value: number) {
		this._code = value;
	}

	public get stderr(): string {
		return this._stderr;
	}

	public set stderr(value: string) {
		this._stderr = value;
		this.setMessage();
	}

	private setMessage(): void {
		this.message = loc.unexpectedExitCode(this._code, this._stderr);
	}
}

export type ProcessOutput = { stdout: string, stderr: string };

/**
 * Executes the specified command. Throws an error for a non-0 exit code or if stderr receives output
 * @param command The command to execute
 * @param args Optional args to pass, every arg and arg value must be a separate item in the array
 * @param additionalEnvVars Additional environment variables to add to the process environment
 */
export async function executeCommand(command: string, args: string[], additionalEnvVars?: AdditionalEnvVars): Promise<ProcessOutput> {
	return new Promise((resolve, reject) => {
		Logger.log(loc.executingCommand(command, args));
		const stdoutBuffers: Buffer[] = [];
		const stderrBuffers: Buffer[] = [];
		const env = Object.assign({}, process.env, additionalEnvVars);
		const child = cp.spawn(command, args, { shell: true, env: env });
		child.stdout.on('data', (b: Buffer) => stdoutBuffers.push(b));
		child.stderr.on('data', (b: Buffer) => stderrBuffers.push(b));
		child.on('error', reject);
		child.on('exit', code => {
			const stdout = Buffer.concat(stdoutBuffers).toString('utf8').trim();
			const stderr = Buffer.concat(stderrBuffers).toString('utf8').trim();
			if (stdout) {
				Logger.log(loc.stdoutOutput(stdout));
			}
			if (stderr) {
				Logger.log(loc.stderrOutput(stderr));
			}
			if (code) {
				const err = new ExitCodeError(code, stderr);
				Logger.log(err.message);
				reject(err);
			} else {
				resolve({ stdout: stdout, stderr: stderr });
			}
		});
	});
}

/**
 * Executes a command with admin privileges. The user will be prompted to enter credentials for invocation of
 * this function. The exact prompt is platform-dependent.
 * @param command The command to execute
 * @param args The additional args
 */
export async function executeSudoCommand(command: string): Promise<ProcessOutput> {
	return new Promise((resolve, reject) => {
		Logger.log(loc.executingCommand(`sudo ${command}`, []));
		sudo.exec(command, { name: 'Azure Data Studio' }, (error, stdout, stderr) => {
			stdout = stdout?.toString() ?? '';
			stderr = stderr?.toString() ?? '';
			if (stdout) {
				Logger.log(loc.stdoutOutput(stdout));
			}
			if (stderr) {
				Logger.log(loc.stderrOutput(stderr));
			}
			if (error) {
				Logger.log(loc.unexpectedCommandError(error.message));
				reject(error);
			} else {
				resolve({ stdout: stdout, stderr: stderr });
			}
		});
	});
}
