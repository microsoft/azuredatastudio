/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as sudo from 'sudo-prompt';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { OsType } from '../interfaces';

const localize = nls.loadMessageBundle();
const extensionOutputChannel = localize('resourceDeployment.outputChannel', 'Deployments');
const sudoPromptTitle = 'AzureDataStudio';

/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	osType(): OsType;
	platform(): string;
	storagePath(): string;
	copyFile(source: string, target: string): Promise<void>;
	fileExists(file: string): Promise<boolean>;
	openFile(filePath: string): void;
	showErrorMessage(message: string): void;
	logToOutputChannel(data: string | Buffer, header?: string): void;
	isNotebookNameUsed(title: string): boolean;
	makeDirectory(path: string): Promise<void>;
	readTextFile(filePath: string): Promise<string>;
	runCommand(command: string, options?: CommandOptions, sudo?: boolean, commandTitle?: string): Promise<string>;
}

export interface CommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
}

/**
 * A class that provides various services to interact with the platform on which the code runs
 */
export class PlatformService implements IPlatformService {
	private _outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(extensionOutputChannel);

	constructor(private _storagePath: string = '') {
	}

	storagePath(): string {
		return this._storagePath;
	}

	platform(): string {
		return process.platform;
	}

	osType(platform: string = this.platform()): OsType {
		return (<any>OsType)[platform] || OsType.others;
	}

	copyFile(source: string, target: string): Promise<void> {
		return fs.promises.copyFile(source, target);
	}

	fileExists(file: string): Promise<boolean> {
		return fs.promises.access(file).then(() => {
			return true;
		}).catch(error => {
			if (error && error.code === 'ENOENT') {
				return false;
			}
			throw error;
		});
	}

	openFile(filePath: string): void {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	private getErrorMessage(error: Error | string): string {
		return (error instanceof Error) ? error.message : error;
	}

	showErrorMessage(error: Error | string): void {
		vscode.window.showErrorMessage(this.getErrorMessage(error));
	}

	isNotebookNameUsed(title: string): boolean {
		return (azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1);
	}

	makeDirectory(path: string): Promise<void> {
		return fs.promises.mkdir(path);
	}

	readTextFile(filePath: string): Promise<string> {
		return fs.promises.readFile(filePath, 'utf8');
	}

	public logToOutputChannel(data: string | Buffer, header?: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				this._outputChannel.appendLine(header ? header + line : line);
			});
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}

	async runCommand(command: string, options?: CommandOptions, sudo?: boolean, commandTitle?: string): Promise<string> {
		if (commandTitle !== undefined && commandTitle !== null) {
			this._outputChannel.appendLine(`\t<<<${commandTitle}>>>`);
		}
		console.log(`TCL: PlatformService -> options: ${JSON.stringify(options)}`);
		if (sudo) {
			return this.runSudoCommand(command, options, this._outputChannel);
		} else {
			return this.runStreamedCommand(command, options, this._outputChannel);
		}
	}

	private runSudoCommand(cmd: string, options: CommandOptions | undefined, outputChannel: vscode.OutputChannel): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (outputChannel) {
				outputChannel.appendLine(`    > ${cmd}`);
			}

			if (options && options.workingDirectory) {
				process.chdir(options.workingDirectory);
			}

			// Workaround for https://github.com/jorangreef/sudo-prompt/issues/111
			const origEnv: NodeJS.ProcessEnv = Object.assign({}, process.env, options && options.additionalEnvironmentVariables);
			const env: NodeJS.ProcessEnv = {};

			Object.keys(origEnv).filter(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)).forEach((key) => {
				env[key] = origEnv[key];
			});

			const sudoOptions = {
				name: sudoPromptTitle,
				env: env
			};
			sudo.exec(cmd, sudoOptions, (error, stdout, stderr) => {
				if (error) {
					this.outputDataChunk(error, outputChannel, '    stderr: ');
					reject(error);
				} else {
					if (stdout) {
						this.outputDataChunk(stdout, outputChannel, '    stdout: ');
					}
					if (stderr) {
						this.outputDataChunk(stderr, outputChannel, '    stderr: ');
					}
					resolve(stdout);
				}
			});
		});
	}

	private runStreamedCommand(cmd: string, options?: CommandOptions, outputChannel?: vscode.OutputChannel): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const stdoutData: string[] = [];
			if (outputChannel) {
				outputChannel.appendLine(`    > ${cmd}`);
			}

			const spawnOptions: cp.SpawnOptions = {
				cwd: options && options.workingDirectory,
				env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
				shell: true,
				detached: false,
				windowsHide: true
			};

			let child = cp.spawn(cmd, [], spawnOptions);
			// Add listeners to resolve/reject the promise on exit
			child.on('error', (error: Error) => {
				reject(error);
			});
			child.on('exit', (code: number) => {
				if (code === 0) {
					resolve(stdoutData.join(''));
				} else {
					reject(localize('spawnCommandProcessExited', 'Process exited with code {0}', code));
				}
			});
			// Add listeners to print stdout and stderr if an output channel was provided
			if (outputChannel && child && child.stdout && child.stderr) {
				child.stdout.on('data', data => {
					stdoutData.push(data);
					this.outputDataChunk(data, outputChannel, '    stdout: ');
				});
				child.stderr.on('data', data => { this.outputDataChunk(data, outputChannel, '    stderr: '); });
			}
		});
	}
}
