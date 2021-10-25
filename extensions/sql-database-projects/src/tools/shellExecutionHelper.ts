/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as cp from 'promisify-child-process';
import * as childProcess from 'child_process';
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
	public async runStreamedCommand(command: string, outputChannel: vscode.OutputChannel, options?: ShellCommandOptions): Promise<string> {
		const stdoutData: string[] = [];
		outputChannel.appendLine(`    > ${command}`);

		const spawnOptions = {
			cwd: options && options.workingDirectory,
			env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024, // 10 Mb of output can be captured.
			shell: true,
			detached: false,
			windowsHide: true
		};

		const child = cp.spawn(command, [], spawnOptions);
		outputChannel.show();

		// Add listeners to print stdout and stderr and exit code
		void child.on('exit', (code: number | null, signal: string | null) => {
			if (code !== null) {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithCode', "    >>> {0}    … exited with code: {1}", command, code));
			} else {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithSignal', "    >>> {0}   … exited with signal: {1}", command, signal));
			}
		});

		child.stdout!.on('data', (data: string | Buffer) => {
			stdoutData.push(data.toString());
			ShellExecutionHelper.outputDataChunk(outputChannel, data, localize('sqlDatabaseProjects.RunCommand.stdout', "    stdout: "));
		});

		child.stderr!.on('data', (data: string | Buffer) => {
			ShellExecutionHelper.outputDataChunk(outputChannel, data, localize('sqlDatabaseProjects.RunCommand.stderr', "    stderr: "));
		});

		await child;

		return stdoutData.join('');
	}

	public static async executeCommand(cmd: string, outputChannel: vscode.OutputChannel, sensitiveData: string[] = [], timeout: number = 5 * 60 * 1000): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (outputChannel) {
				let cmdOutputMessage = cmd;

				sensitiveData.forEach(element => {
					cmdOutputMessage = cmdOutputMessage.replace(element, '***');
				});

				outputChannel.appendLine(`    > ${cmdOutputMessage}`);
			}
			let child = childProcess.exec(cmd, {
				timeout: timeout
			}, (err, stdout) => {
				if (err) {
					// removing sensitive data from the exception
					sensitiveData.forEach(element => {
						err.cmd = err.cmd?.replace(element, '***');
						err.message = err.message?.replace(element, '***');
					});
					reject(err);
				} else {
					resolve(stdout);
				}
			});

			// Add listeners to print stdout and stderr if an output channel was provided

			if (child?.stdout) {
				child.stdout.on('data', data => { this.outputDataChunk(outputChannel, data, '    stdout: '); });
			}
			if (child?.stderr) {
				child.stderr.on('data', data => { this.outputDataChunk(outputChannel, data, '    stderr: '); });
			}
		});
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
