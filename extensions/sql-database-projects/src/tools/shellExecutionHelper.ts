/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'promisify-child-process';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export interface ShellCommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
	commandTitle?: string;
	argument?: string;
}

export class ShellExecutionHelper {
	constructor(protected _outputChannel: vscode.OutputChannel) {
	}

	/**
	 * spawns the shell command with arguments and redirects the error and output to ADS output channel
	 */
	public async runStreamedCommand(command: string, options?: ShellCommandOptions, sensitiveData: string[] = [], timeout: number = 5 * 60 * 1000): Promise<string> {
		const stdoutData: string[] = [];

		let cmdOutputMessage = command;
		sensitiveData.forEach(element => {
			cmdOutputMessage = cmdOutputMessage.replace(element, '***');
		});

		this._outputChannel.appendLine(`    > ${cmdOutputMessage}`);

		const spawnOptions = {
			cwd: options && options.workingDirectory,
			env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024, // 10 Mb of output can be captured.
			shell: true,
			detached: false,
			windowsHide: true,
			timeout: timeout
		};

		try {
			const child = cp.spawn(command, [], spawnOptions);
			this._outputChannel.show();

			// Add listeners to print stdout and stderr and exit code
			void child.on('exit', (code: number | null, signal: string | null) => {
				if (code !== null) {
					this._outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithCode', "    >>> {0}    … exited with code: {1}", command, code));
				} else {
					this._outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithSignal', "    >>> {0}   … exited with signal: {1}", command, signal));
				}
			});

			child.stdout!.on('data', (data: string | Buffer) => {
				stdoutData.push(data.toString());
				ShellExecutionHelper.outputDataChunk(this._outputChannel, data, localize('sqlDatabaseProjects.RunCommand.stdout', "    stdout: "));
			});

			child.stderr!.on('data', (data: string | Buffer) => {
				ShellExecutionHelper.outputDataChunk(this._outputChannel, data, localize('sqlDatabaseProjects.RunCommand.stderr', "    stderr: "));
			});

			await child;

			return stdoutData.join('');
		}
		catch (err) {
			// removing sensitive data from the exception
			sensitiveData.forEach(element => {
				err.cmd = err.cmd?.replace(element, '***');
				err.message = err.message?.replace(element, '***');
			});

			throw err;
		}
	}

	public static async executeCommand(cmd: string, outputChannel: vscode.OutputChannel, sensitiveData: string[] = [], timeout: number = 5 * 60 * 1000): Promise<string> {
		return new ShellExecutionHelper(outputChannel).runStreamedCommand(cmd, undefined, sensitiveData, timeout);
	}

	private static outputDataChunk(outputChannel: vscode.OutputChannel, data: string | Buffer, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				if (outputChannel) {
					outputChannel.appendLine(header + line);
				}
			});
	}
}
