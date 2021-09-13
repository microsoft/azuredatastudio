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
	 * spawns the dotnet command with arguments and redirects the error and output to ADS output channel
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
		child.on('exit', (code: number | null, signal: string | null) => {
			if (code !== null) {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithCode', "    >>> {0}    … exited with code: {1}", command, code));
			} else {
				outputChannel.appendLine(localize('sqlDatabaseProjects.RunStreamedCommand.ExitedWithSignal', "    >>> {0}   … exited with signal: {1}", command, signal));
			}
		});

		child.stdout!.on('data', (data: string | Buffer) => {
			stdoutData.push(data.toString());
			this.outputDataChunk(data, outputChannel, localize('sqlDatabaseProjects.RunCommand.stdout', "    stdout: "));
		});

		child.stderr!.on('data', (data: string | Buffer) => {
			this.outputDataChunk(data, outputChannel, localize('sqlDatabaseProjects.RunCommand.stderr', "    stderr: "));
		});

		await child;

		return stdoutData.join('');
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}
}
