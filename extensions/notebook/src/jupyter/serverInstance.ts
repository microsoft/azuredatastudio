/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { spawn, SpawnOptions, ChildProcess } from 'child_process';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { IServerInstance } from './common';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as utils from '../common/utils';
import * as constants from '../common/constants';

const NotebookConfigFilename = 'jupyter_notebook_config.py';
const CustomJsFilename = 'custom.js';

type MessageListener = (data: string | Buffer) => void;
type ErrorListener = (err: any) => void;

/**
 * Helper function ensures server instance process stops
 */
export function ensureProcessEnded(childProcess: ChildProcess): void {
	if (!childProcess) {
		return;
	}
	// Wait 5 seconds and then force kill. Jupyter stop is slow so this seems a reasonable time limit
	setTimeout(() => {
		// Test if the process is still alive. Throws an exception if not
		try {
			process.kill(childProcess.pid, 'SIGKILL');
		} catch (error) {
			if (!error || !error.code || (typeof error.code === 'string' && error.code !== 'ESRCH')) {
				console.log(error);
			}
		}
	}, 5000);
}

export interface IInstanceOptions {
	/**
	 * The path to the initial document we want to start this server for
	 */
	documentPath: string;

	/**
	 * Base install information needed in order to start the server instance
	 */
	install: JupyterServerInstallation;

	/**
	 * Optional start directory for the notebook server. If none is set, will use a
	 * path relative to the initial document
	 */
	notebookDirectory?: string;
}

export class PerFolderServerInstance implements IServerInstance {

	/**
	 * Root of the jupyter directory structure. Config and data roots will be
	 * under this, in order to simplify deletion of folders on stop of the instance
	 */
	private baseDir: string;

	/**
	 * Path to configuration folder for this instance. Typically:
	 * %extension_path%/jupyter_config/%server%_config
	 */
	private instanceConfigRoot: string;

	/**
	 * Path to data folder for this instance. Typically:
	 * %extension_path%/jupyter_config/%server%_data
	 */
	private instanceDataRoot: string;

	private _systemJupyterDir: string;
	private _port: string;
	private _token: string;
	private _uri: vscode.Uri;
	private _isStarted: boolean = false;
	private _isStopping: boolean = false;
	private childProcess: ChildProcess;
	private errorHandler: ErrorHandler = new ErrorHandler();

	private readonly notebookScriptPath: string;

	constructor(private options: IInstanceOptions) {
		this.notebookScriptPath = path.join(this.options.install.extensionPath, 'resources', 'pythonScripts', 'startNotebook.py');
	}

	public get isStarted(): boolean {
		return this._isStarted && !this._isStopping;
	}

	public get port(): string {
		return this._port;
	}

	public get uri(): vscode.Uri {
		return this._uri;
	}

	public async configure(): Promise<void> {
		await this.configureJupyter();
	}

	public async start(): Promise<void> {
		await this.startInternal();
	}

	public async stop(): Promise<void> {
		try {
			this._isStopping = true;
			if (this.baseDir) {
				let exists = await fs.pathExists(this.baseDir);
				if (exists) {
					await fs.remove(this.baseDir);
				}
			}
			if (this._isStarted) {
				let install = this.options.install;
				let stopCommand = `"${install.pythonExecutable}" "${this.notebookScriptPath}" stop ${this._port}`;
				await utils.executeBufferedCommand(stopCommand, install.execOptions, install.outputChannel);
			}
		} catch (error) {
			// For now, we don't care as this is non-critical
			this.notify(this.options.install, localize('serverStopError', "Error stopping Notebook Server: {0}", utils.getErrorMessage(error)));
		} finally {
			this._isStarted = false;
			ensureProcessEnded(this.childProcess);
			this.handleConnectionClosed();

		}
	}

	private async configureJupyter(): Promise<void> {
		this.createInstanceFolders();
		let resourcesFolder = path.join(this.options.install.extensionPath, 'resources', constants.jupyterConfigRootFolder);
		this.copyInstanceConfig(resourcesFolder);
		this.copyCustomJs(resourcesFolder);
		await this.copyKernelsToSystemJupyterDirs();
	}

	private createInstanceFolders(): void {
		this.baseDir = path.join(this.getSystemJupyterHomeDir(), 'instances', `${UUID.generateUuid()}`);
		this.instanceConfigRoot = path.join(this.baseDir, 'config');
		this.instanceDataRoot = path.join(this.baseDir, 'data');
		utils.ensureDirSync(this.baseDir, this.options.install.outputChannel);
		utils.ensureDirSync(this.instanceConfigRoot, this.options.install.outputChannel);
		utils.ensureDirSync(this.instanceDataRoot, this.options.install.outputChannel);
	}

	private copyInstanceConfig(resourcesFolder: string): void {
		let configSource = path.join(resourcesFolder, NotebookConfigFilename);
		let configDest = path.join(this.instanceConfigRoot, NotebookConfigFilename);
		fs.copySync(configSource, configDest);
	}

	private copyCustomJs(resourcesFolder: string): void {
		let customPath = path.join(this.instanceConfigRoot, 'custom');
		utils.ensureDirSync(customPath, this.options.install.outputChannel);
		let customSource = path.join(resourcesFolder, CustomJsFilename);
		let customDest = path.join(customPath, CustomJsFilename);
		fs.copySync(customSource, customDest);
	}

	private async copyKernelsToSystemJupyterDirs(): Promise<void> {
		let kernelsExtensionSource: string;
		if (this.options.install.runningOnSaw) {
			kernelsExtensionSource = path.join(this.options.install.extensionPath, 'saw-kernels');
		} else {
			kernelsExtensionSource = path.join(this.options.install.extensionPath, 'kernels');
		}
		this._systemJupyterDir = path.join(this.getSystemJupyterHomeDir(), 'kernels');
		utils.ensureDirSync(this._systemJupyterDir, this.options.install.outputChannel);
		fs.copySync(kernelsExtensionSource, this._systemJupyterDir);
		if (this.options.install.runningOnSaw) {
			await this.options.install.updateKernelSpecPaths(this._systemJupyterDir);
		}
	}

	private getSystemJupyterHomeDir(): string {
		switch (process.platform) {
			case 'win32':
				let appDataWindows = process.env['APPDATA'];
				return appDataWindows + '\\jupyter';
			case 'darwin':
				return path.resolve(os.homedir(), 'Library/Jupyter');
			default:
				return path.resolve(os.homedir(), '.local/share/jupyter');
		}
	}

	/**
	 * Starts a Jupyter instance using the provided a start command. Server is determined to have
	 * started when the log message with URL to connect to is emitted.
	 */
	protected async startInternal(): Promise<void> {
		let startCommand: string;
		let notebookConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		let allowRoot: boolean = notebookConfig.get(constants.allowRoot);
		if (this.isStarted) {
			return;
		}
		let notebookDirectory = this.getNotebookDirectory();
		this._token = await utils.getRandomToken();
		const allowRootParam = allowRoot ? '--allow-root' : '';
		startCommand = `"${this.options.install.pythonExecutable}" "${this.notebookScriptPath}" --no-browser --ip=127.0.0.1 ${allowRootParam} --no-mathjax --notebook-dir "${notebookDirectory}" --NotebookApp.token=${this._token}`;
		this.notifyStarting(this.options.install, startCommand);

		// Execute the command
		await this.executeStartCommand(startCommand);
	}

	private executeStartCommand(startCommand: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let install = this.options.install;
			this.childProcess = this.spawnJupyterProcess(install, startCommand);
			let stdErrLog: string = '';
			// Add listeners for the process exiting prematurely
			let onErrorBeforeStartup = (err: any) => reject(err);
			let onExitBeforeStart = (err: any) => {
				if (!this.isStarted) {
					reject(localize('notebookStartProcessExitPremature', "Notebook process exited prematurely with error code: {0}. StdErr Output: {1}", err, stdErrLog));
				}
			};
			this.childProcess.on('error', onErrorBeforeStartup);
			this.childProcess.on('exit', onExitBeforeStart);

			// Add listener for the process to emit its web address
			let handleStdout = (data: string | Buffer) => { install.outputChannel.appendLine(data.toString()); };
			let handleStdErr = (data: string | Buffer) => {
				// For some reason, URL info is sent on StdErr
				let port: string = this.getPort(data);
				if (port) {
					let url: vscode.Uri = vscode.Uri.parse(`http://localhost:${port}/?token=${this._token}`);
					this._uri = url;
					this._port = port;
					this.notifyStarted(install, url.toString(true));
					this._isStarted = true;

					this.updateListeners(handleStdout, handleStdErr, onErrorBeforeStartup, onExitBeforeStart);
					resolve();
				} else {
					stdErrLog += data.toString();
				}
			};
			this.childProcess.stdout.on('data', handleStdout);
			this.childProcess.stderr.on('data', handleStdErr);
		});
	}

	private updateListeners(handleStdout: MessageListener, handleStdErr: MessageListener, onErrorBeforeStartup: ErrorListener, onExitBeforeStart: ErrorListener): void {
		this.childProcess.stdout.removeListener('data', handleStdout);
		this.childProcess.stderr.removeListener('data', handleStdErr);
		this.childProcess.removeListener('error', onErrorBeforeStartup);
		this.childProcess.removeListener('exit', onExitBeforeStart);

		this.childProcess.addListener('error', this.handleConnectionError);
		this.childProcess.addListener('exit', this.handleConnectionClosed);

		process.addListener('exit', this.stop);

		// TODO #897 covers serializing stdout and stderr to a location where we can read from so that user can see if they run into trouble
	}

	private handleConnectionError(error: Error): void {
		let action = this.errorHandler.handleError();
		if (action === ErrorAction.Shutdown) {
			this.notify(this.options.install, localize('jupyterError', "Error sent from Jupyter: {0}", utils.getErrorMessage(error)));
			this.stop();
		}
	}
	private handleConnectionClosed(): void {
		this.childProcess = undefined;
		this._isStarted = false;
	}

	getNotebookDirectory(): string {
		if (this.options.notebookDirectory) {
			if (this.options.notebookDirectory.endsWith('\\')) {
				return this.options.notebookDirectory.substr(0, this.options.notebookDirectory.length - 1) + '/';
			}
			return this.options.notebookDirectory;
		}
		return path.dirname(this.options.documentPath);
	}

	private getPort(data: string | Buffer): string | undefined {
		// regex: Looks for the successful startup log message like:
		//        [C 12:08:51.947 NotebookApp]
		//
		//             Copy/paste this URL into your browser when you connect for the first time,
		//             to login with a token:
		//                http://localhost:8888/?token=f5ee846e9bd61c3a8d835ecd9b965591511a331417b997b7
		let dataString = data.toString();
		let match = dataString.match(/.+:(\d+)\/.*$/m);
		return match && match[1] ? match[1] : undefined;
	}

	private notifyStarted(install: JupyterServerInstallation, jupyterUri: string): void {
		install.outputChannel.appendLine(localize('jupyterOutputMsgStartSuccessful', "... Jupyter is running at {0}", jupyterUri));
	}
	private notify(install: JupyterServerInstallation, message: string): void {
		install.outputChannel.appendLine(message);
	}

	private notifyStarting(install: JupyterServerInstallation, startCommand: string): void {
		install.outputChannel.appendLine(localize('jupyterOutputMsgStart', "... Starting Notebook server"));
		install.outputChannel.appendLine(`    > ${startCommand}`);
	}

	private spawnJupyterProcess(install: JupyterServerInstallation, startCommand: string): ChildProcess {
		// Specify the global environment variables.
		// Note: Get env from the install since it gets used elsewhere
		let env = this.getEnvWithConfigPaths(install.execOptions.env);

		// Start the notebook process
		let options: SpawnOptions = {
			shell: true,
			env: env,
			detached: false
		};
		let childProcess = spawn(startCommand, [], options);
		return childProcess;
	}

	private getEnvWithConfigPaths(env: { [key: string]: string }): any {
		// Take the variables that starts with 'AZDATA_NB_VAR_' from process.env object so that we can pass information to notebooks
		let newEnv: { [key: string]: string } = Object.assign({}, env);
		Object.keys(process.env).filter(key => key.startsWith('AZDATA_NB_VAR_')).forEach(key => {
			newEnv[key] = process.env[key];
		});

		newEnv['JUPYTER_CONFIG_DIR'] = this.instanceConfigRoot;
		newEnv['JUPYTER_PATH'] = this.instanceDataRoot;
		return newEnv;
	}
}

class ErrorHandler {
	private numErrors: number = 0;

	public handleError(): ErrorAction {
		this.numErrors++;
		return this.numErrors > 3 ? ErrorAction.Shutdown : ErrorAction.Continue;
	}
}

enum ErrorAction {
	Continue = 1,
	Shutdown = 2
}
