/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as sudo from 'sudo-prompt';
import * as loc from '../localizedConstants';

/**
 * Wrapper error for when an unexpected exit code was received
 */
export class ExitCodeError extends Error {
	constructor(public code: number) {
		super(loc.unexpectedExitCode(code));
	}
}

export type ProcessOutput = { stdout: string, stderr: string };

/**
 * Executes the specified command. Throws an error for a non-0 exit code or if stderr receives output
 * @param command The command to execute
 * @param args Optional args to pass, every arg and arg value must be a separate item in the array
 * @param outputChannel Channel used to display diagnostic information
 */
export async function executeCommand(command: string, args: string[], outputChannel: vscode.OutputChannel): Promise<ProcessOutput> {
	return new Promise((resolve, reject) => {
		outputChannel.appendLine(loc.executingCommand(command, args));
		const stdoutBuffers: Buffer[] = [];
		const stderrBuffers: Buffer[] = [];
		const child = cp.spawn(command, args, { shell: true });
		child.stdout.on('data', (b: Buffer) => stdoutBuffers.push(b));
		child.stderr.on('data', (b: Buffer) => stderrBuffers.push(b));
		child.on('error', reject);
		child.on('exit', code => {
			const stdout = Buffer.concat(stdoutBuffers).toString('utf8').trim();
			const stderr = Buffer.concat(stderrBuffers).toString('utf8').trim();
			if (stdout) {
				outputChannel.appendLine(loc.stdoutOutput(stdout));
			}
			if (stderr) {
				outputChannel.appendLine(loc.stdoutOutput(stderr));
			}
			if (code) {
				const err = new ExitCodeError(code);
				outputChannel.appendLine(err.message);
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
 * @param outputChannel Channel used to display diagnostic information
 */
export async function executeSudoCommand(command: string, outputChannel: vscode.OutputChannel): Promise<ProcessOutput> {
	return new Promise((resolve, reject) => {
		outputChannel.appendLine(loc.executingCommand(`sudo ${command}`, []));
		sudo.exec(command, { name: vscode.env.appName }, (error, stdout, stderr) => {
			stdout = stdout?.toString() ?? '';
			stderr = stderr?.toString() ?? '';
			if (stdout) {
				outputChannel.appendLine(loc.stdoutOutput(stdout));
			}
			if (stderr) {
				outputChannel.appendLine(loc.stdoutOutput(stderr));
			}
			if (error) {
				outputChannel.appendLine(loc.unexpectedCommandError(error.message));
				reject(error);
			} else {
				resolve({ stdout: stdout, stderr: stderr });
			}
		});
	});
}
