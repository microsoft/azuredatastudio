/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { ExecOptions } from 'child_process';
import * as decompress from 'decompress';
import * as request from 'request';

import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { OutputChannel, ConfigurationTarget, Event, EventEmitter, window } from 'vscode';

const localize = nls.loadMessageBundle();
const msgPythonInstallationProgress = localize('msgPythonInstallationProgress', 'Python installation is in progress');
const msgPythonInstallationComplete = localize('msgPythonInstallationComplete', 'Python installation is complete');
const msgPythonDownloadError = localize('msgPythonDownloadError', 'Error while downloading python setup');
const msgPythonDownloadPending = localize('msgPythonDownloadPending', 'Downloading python package');
const msgPythonUnpackPending = localize('msgPythonUnpackPending', 'Unpacking python package');
const msgPythonDirectoryError = localize('msgPythonDirectoryError', 'Error while creating python installation directory');
const msgPythonUnpackError = localize('msgPythonUnpackError', 'Error while unpacking python bundle');
const msgTaskName = localize('msgTaskName', 'Installing Notebook dependencies');
const msgInstallPkgStart = localize('msgInstallPkgStart', 'Installing Notebook dependencies, see Tasks view for more information');
const msgInstallPkgFinish = localize('msgInstallPkgFinish', 'Notebook dependencies installation is complete');
function msgDependenciesInstallationFailed(errorMessage: string): string { return localize('msgDependenciesInstallationFailed', 'Installing Notebook dependencies failed with error: {0}', errorMessage); }
function msgDownloadPython(platform: string, pythonDownloadUrl: string): string { return localize('msgDownloadPython', 'Downloading local python for platform: {0} to {1}', platform, pythonDownloadUrl); }

export default class JupyterServerInstallation {
	/**
	 * Path to the folder where all configuration sets will be stored. Should always be:
	 * %extension_path%/jupyter_config
	 */
	public apiWrapper: ApiWrapper;
	public extensionPath: string;
	public pythonBinPath: string;
	public outputChannel: OutputChannel;
	public configRoot: string;
	public pythonEnvVarPath: string;
	public execOptions: ExecOptions;

	private _pythonInstallationPath: string;
	private _pythonExecutable: string;
	private _pythonPackageDir: string;

	// Allows dependencies to be installed even if an existing installation is already present
	private _forceInstall: boolean;

	private static readonly DefaultPythonLocation = path.join(utils.getUserHome(), 'azuredatastudio-python');

	private _installCompleteEmitter = new EventEmitter<string>();

	constructor(extensionPath: string, outputChannel: OutputChannel, apiWrapper: ApiWrapper, pythonInstallationPath?: string, forceInstall?: boolean) {
		this.extensionPath = extensionPath;
		this.outputChannel = outputChannel;
		this.apiWrapper = apiWrapper;
		this._pythonInstallationPath = pythonInstallationPath || JupyterServerInstallation.getPythonInstallPath(this.apiWrapper);
		this.configRoot = path.join(this.extensionPath, constants.jupyterConfigRootFolder);
		this._forceInstall = !!forceInstall;

		this.configurePackagePaths();
	}

	public get onInstallComplete(): Event<string> {
		return this._installCompleteEmitter.event;
	}

	public static async getInstallation(
		extensionPath: string,
		outputChannel: OutputChannel,
		apiWrapper: ApiWrapper,
		pythonInstallationPath?: string,
		forceInstall?: boolean): Promise<JupyterServerInstallation> {

		let installation = new JupyterServerInstallation(extensionPath, outputChannel, apiWrapper, pythonInstallationPath, forceInstall);
		await installation.startInstallProcess();

		return installation;
	}

	private async installDependencies(backgroundOperation: sqlops.BackgroundOperation): Promise<void> {
		if (!fs.existsSync(this._pythonExecutable) || this._forceInstall) {
			window.showInformationMessage(msgInstallPkgStart);
			this.outputChannel.show(true);
			this.outputChannel.appendLine(msgPythonInstallationProgress);
			backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonInstallationProgress);
			await this.installPythonPackage(backgroundOperation);
			backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonInstallationComplete);
			this.outputChannel.appendLine(msgPythonInstallationComplete);

			// Install jupyter on Windows because local python is not bundled with jupyter unlike linux and MacOS.
			await this.installJupyterProsePackage();
			await this.installSparkMagic();
			backgroundOperation.updateStatus(sqlops.TaskStatus.Succeeded, msgInstallPkgFinish);
			window.showInformationMessage(msgInstallPkgFinish);
		}
	}

	private installPythonPackage(backgroundOperation: sqlops.BackgroundOperation): Promise<void> {
		let bundleVersion = constants.pythonBundleVersion;
		let pythonVersion = constants.pythonVersion;
		let packageName = 'python-#pythonversion-#platform-#bundleversion.#extension';
		let platformId = utils.getOSPlatformId();

		packageName = packageName.replace('#platform', platformId)
			.replace('#pythonversion', pythonVersion)
			.replace('#bundleversion', bundleVersion)
			.replace('#extension', process.platform === constants.winPlatform ? 'zip' : 'tar.gz');

		let pythonDownloadUrl = undefined;
		switch (utils.getOSPlatform()) {
			case utils.Platform.Windows:
				pythonDownloadUrl = 'https://go.microsoft.com/fwlink/?linkid=2074021';
				break;
			case utils.Platform.Mac:
				pythonDownloadUrl = 'https://go.microsoft.com/fwlink/?linkid=2065976';
				break;
			default:
				// Default to linux
				pythonDownloadUrl = 'https://go.microsoft.com/fwlink/?linkid=2065975';
				break;
		}

		let pythonPackagePathLocal = this._pythonInstallationPath + '/' + packageName;
		let self = undefined;
		return new Promise((resolve, reject) => {
			self = this;
			backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgDownloadPython(platformId, pythonDownloadUrl));
			fs.mkdirs(this._pythonInstallationPath, (err) => {
				if (err) {
					backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonDirectoryError);
					reject(err);
				}

				let totalMegaBytes: number = undefined;
				let receivedBytes = 0;
				let printThreshold = 0.1;
				request.get(pythonDownloadUrl, { timeout: 20000 })
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
					})
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonDownloadError);
							reject(response.statusMessage);
						}

						let totalBytes = parseInt(response.headers['content-length']);
						totalMegaBytes = totalBytes / (1024 * 1024);
						this.outputChannel.appendLine(`${msgPythonDownloadPending} (0 / ${totalMegaBytes.toFixed(2)} MB)`);
					})
					.on('data', (data) => {
						receivedBytes += data.length;
						if (totalMegaBytes) {
							let receivedMegaBytes = receivedBytes / (1024 * 1024);
							let percentage = receivedMegaBytes / totalMegaBytes;
							if (percentage >= printThreshold) {
								this.outputChannel.appendLine(`${msgPythonDownloadPending} (${receivedMegaBytes.toFixed(2)} / ${totalMegaBytes.toFixed(2)} MB)`);
								printThreshold += 0.1;
							}
						}
					})
					.pipe(fs.createWriteStream(pythonPackagePathLocal))
					.on('close', () => {
						//unpack python zip/tar file
						this.outputChannel.appendLine(msgPythonUnpackPending);
						let pythonSourcePath = path.join(this._pythonInstallationPath, constants.pythonBundleVersion);
						if (fs.existsSync(pythonSourcePath)) {
							try {
								fs.removeSync(pythonSourcePath);
							} catch (err) {
								backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonUnpackError);
								reject(err);
							}
						}
						decompress(pythonPackagePathLocal, self._pythonInstallationPath).then(files => {
							//Delete zip/tar file
							fs.unlink(pythonPackagePathLocal, (err) => {
								if (err) {
									backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonUnpackError);
									reject(err);
								}
							});

							resolve();
						}).catch(err => {
							backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonUnpackError);
							reject(err);
						});
					})
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(sqlops.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
					});
			});
		});
	}

	private configurePackagePaths(): void {
		//Python source path up to bundle version
		let pythonSourcePath = path.join(this._pythonInstallationPath, constants.pythonBundleVersion);

		this._pythonPackageDir = path.join(pythonSourcePath, 'offlinePackages');

		// Update python paths and properties to reference user's local python.
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		this._pythonExecutable = path.join(pythonSourcePath, process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
		this.pythonBinPath = path.join(pythonSourcePath, pythonBinPathSuffix);

		// Store paths to python libraries required to run jupyter.
		this.pythonEnvVarPath = process.env.Path;

		let delimiter = path.delimiter;
		if (process.platform === constants.winPlatform) {
			let pythonScriptsPath = path.join(pythonSourcePath, 'Scripts');
			this.pythonEnvVarPath = pythonScriptsPath + delimiter + this.pythonEnvVarPath;
		}
		this.pythonEnvVarPath = this.pythonBinPath + delimiter + this.pythonEnvVarPath;

		// Store the executable options to run child processes with env var without interfering parent env var.
		let env = Object.assign({}, process.env);
		env['PATH'] = this.pythonEnvVarPath;
		this.execOptions = {
			env: env
		};
	}

	public async startInstallProcess(pythonInstallationPath?: string): Promise<void> {
		if (pythonInstallationPath) {
			this._pythonInstallationPath = pythonInstallationPath;
			this.configurePackagePaths();
		}
		let updateConfig = () => {
			let notebookConfig = this.apiWrapper.getConfiguration(constants.notebookConfigKey);
			notebookConfig.update(constants.pythonPathConfigKey, this._pythonInstallationPath, ConfigurationTarget.Global);
		};
		if (!fs.existsSync(this._pythonExecutable) || this._forceInstall) {
			this.apiWrapper.startBackgroundOperation({
				displayName: msgTaskName,
				description: msgTaskName,
				isCancelable: false,
				operation: op => {
					this.installDependencies(op)
						.then(() => {
							this._installCompleteEmitter.fire();
							updateConfig();
						})
						.catch(err => {
							let errorMsg = msgDependenciesInstallationFailed(err);
							op.updateStatus(sqlops.TaskStatus.Failed, errorMsg);
							this.apiWrapper.showErrorMessage(errorMsg);
							this._installCompleteEmitter.fire(errorMsg);
						});
				}
			});
		} else {
			// Python executable already exists, but the path setting wasn't defined,
			// so update it here
			this._installCompleteEmitter.fire();
			updateConfig();
		}
	}

	private async installJupyterProsePackage(): Promise<void> {
		if (process.platform === constants.winPlatform) {
			let requirements = path.join(this._pythonPackageDir, 'requirements.txt');
			let installJupyterCommand = `${this._pythonExecutable} -m pip install --no-index -r ${requirements} --find-links ${this._pythonPackageDir} --no-warn-script-location`;
			this.outputChannel.show(true);
			this.outputChannel.appendLine(localize('msgInstallStart', 'Installing required packages to run Notebooks...'));
			await utils.executeStreamedCommand(installJupyterCommand, this.outputChannel);
			this.outputChannel.appendLine(localize('msgJupyterInstallDone', '... Jupyter installation complete.'));
		} else {
			return Promise.resolve();
		}
	}

	private async installSparkMagic(): Promise<void> {
		if (process.platform === constants.winPlatform) {
			let sparkWheel = path.join(this._pythonPackageDir, `sparkmagic-${constants.sparkMagicVersion}-py3-none-any.whl`);
			let installSparkMagic = `${this._pythonExecutable} -m pip install --no-index ${sparkWheel} --find-links ${this._pythonPackageDir} --no-warn-script-location`;
			this.outputChannel.show(true);
			this.outputChannel.appendLine(localize('msgInstallingSpark', 'Installing SparkMagic...'));
			await utils.executeStreamedCommand(installSparkMagic, this.outputChannel);
		} else {
			return Promise.resolve();
		}
	}

	public get pythonExecutable(): string {
		return this._pythonExecutable;
	}

	public static isPythonInstalled(apiWrapper: ApiWrapper): boolean {
		// Don't use _pythonExecutable here, since it could be populated with a default value
		let pathSetting = JupyterServerInstallation.getPythonPathSetting(apiWrapper);
		if (!pathSetting) {
			return false;
		}

		let pythonExe = path.join(
			pathSetting,
			constants.pythonBundleVersion,
			process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
		return fs.existsSync(pythonExe);
	}

	public static getPythonInstallPath(apiWrapper: ApiWrapper): string {
		let userPath = JupyterServerInstallation.getPythonPathSetting(apiWrapper);
		return userPath ? userPath : JupyterServerInstallation.DefaultPythonLocation;
	}

	private static getPythonPathSetting(apiWrapper: ApiWrapper): string {
		let path = undefined;
		if (apiWrapper) {
			let notebookConfig = apiWrapper.getConfiguration(constants.notebookConfigKey);
			if (notebookConfig) {
				let configPythonPath = notebookConfig[constants.pythonPathConfigKey];
				if (configPythonPath && fs.existsSync(configPythonPath)) {
					path = configPythonPath;
				}
			}
		}
		return path;
	}

	public static getPythonBinPath(apiWrapper: ApiWrapper): string {
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		return path.join(
			JupyterServerInstallation.getPythonInstallPath(apiWrapper),
			constants.pythonBundleVersion,
			pythonBinPathSuffix);
	}
}