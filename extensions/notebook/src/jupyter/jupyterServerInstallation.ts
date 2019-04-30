/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs-extra';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { ExecOptions } from 'child_process';
import * as decompress from 'decompress';
import * as request from 'request';

import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { OutputChannel, ConfigurationTarget, window } from 'vscode';
import { Deferred } from '../common/promise';
import { ConfigurePythonDialog } from '../dialog/configurePythonDialog';

const localize = nls.loadMessageBundle();
const msgInstallPkgProgress = localize('msgInstallPkgProgress', "Notebook dependencies installation is in progress");
const msgPythonDownloadComplete = localize('msgPythonDownloadComplete', "Python download is complete");
const msgPythonDownloadError = localize('msgPythonDownloadError', "Error while downloading python setup");
const msgPythonDownloadPending = localize('msgPythonDownloadPending', "Downloading python package");
const msgPythonUnpackPending = localize('msgPythonUnpackPending', "Unpacking python package");
const msgPythonDirectoryError = localize('msgPythonDirectoryError', "Error while creating python installation directory");
const msgPythonUnpackError = localize('msgPythonUnpackError', "Error while unpacking python bundle");
const msgTaskName = localize('msgTaskName', "Installing Notebook dependencies");
const msgInstallPkgStart = localize('msgInstallPkgStart', "Installing Notebook dependencies, see Tasks view for more information");
const msgInstallPkgFinish = localize('msgInstallPkgFinish', "Notebook dependencies installation is complete");
const msgPythonRunningError = localize('msgPythonRunningError', "Cannot overwrite existing Python installation while python is running.");
const msgPendingInstallError = localize('msgPendingInstallError', "Another Python installation is currently in progress.");
const msgSkipPythonInstall = localize('msgSkipPythonInstall', "Python already exists at the specific location. Skipping install.");
function msgDependenciesInstallationFailed(errorMessage: string): string { return localize('msgDependenciesInstallationFailed', "Installing Notebook dependencies failed with error: {0}", errorMessage); }
function msgDownloadPython(platform: string, pythonDownloadUrl: string): string { return localize('msgDownloadPython', "Downloading local python for platform: {0} to {1}", platform, pythonDownloadUrl); }

export default class JupyterServerInstallation {
	/**
	 * Path to the folder where all configuration sets will be stored. Should always be:
	 * %extension_path%/jupyter_config
	 */
	public apiWrapper: ApiWrapper;
	public extensionPath: string;
	public pythonBinPath: string;
	public outputChannel: OutputChannel;
	public pythonEnvVarPath: string;
	public execOptions: ExecOptions;

	private _pythonInstallationPath: string;
	private _pythonExecutable: string;
	private _pythonPackageDir: string;
	private _usingExistingPython: boolean;
	private _usingConda: boolean;

	// Allows dependencies to be installed even if an existing installation is already present
	private _forceInstall: boolean;
	private _installInProgress: boolean;

	private static readonly DefaultPythonLocation = path.join(utils.getUserHome(), 'azuredatastudio-python');

	constructor(extensionPath: string, outputChannel: OutputChannel, apiWrapper: ApiWrapper, pythonInstallationPath?: string) {
		this.extensionPath = extensionPath;
		this.outputChannel = outputChannel;
		this.apiWrapper = apiWrapper;
		this._pythonInstallationPath = pythonInstallationPath || JupyterServerInstallation.getPythonInstallPath(this.apiWrapper);
		this._forceInstall = false;
		this._usingConda = false;
		this._installInProgress = false;
		this._usingExistingPython = JupyterServerInstallation.getExistingPythonSetting(this.apiWrapper);

		this.configurePackagePaths();
	}

	private async installDependencies(backgroundOperation: azdata.BackgroundOperation): Promise<void> {
		if (!fs.existsSync(this._pythonExecutable) || this._forceInstall || this._usingExistingPython) {
			window.showInformationMessage(msgInstallPkgStart);

			this.outputChannel.show(true);
			this.outputChannel.appendLine(msgInstallPkgProgress);
			backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgInstallPkgProgress);

			await this.installPythonPackage(backgroundOperation);
			this.outputChannel.appendLine(msgPythonDownloadComplete);
			backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadComplete);

			if (this._usingConda) {
				await this.installCondaPackages();
			} else if (this._usingExistingPython) {
				await this.installPipPackages();
			} else {
				await this.installOfflinePipPackages();
			}
			let doOnlineInstall = this._usingExistingPython;
			await this.installSparkMagic(doOnlineInstall);

			fs.remove(this._pythonPackageDir, (err: Error) => {
				if (err) {
					this.outputChannel.appendLine(err.message);
				}
			});

			this.outputChannel.appendLine(msgInstallPkgFinish);
			backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, msgInstallPkgFinish);
			window.showInformationMessage(msgInstallPkgFinish);
		}
	}

	private installPythonPackage(backgroundOperation: azdata.BackgroundOperation): Promise<void> {
		let bundleVersion = constants.pythonBundleVersion;
		let pythonVersion = constants.pythonVersion;
		let platformId = utils.getOSPlatformId();
		let packageName: string;
		let pythonDownloadUrl: string;
		if (this._usingExistingPython) {
			packageName = `python-${pythonVersion}-${bundleVersion}-offlinePackages.zip`;
			pythonDownloadUrl = 'https://go.microsoft.com/fwlink/?linkid=2086702';
		} else {
			let extension = process.platform === constants.winPlatform ? 'zip' : 'tar.gz';
			packageName = `python-${pythonVersion}-${platformId}-${bundleVersion}.${extension}`;

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
		}

		let pythonPackagePathLocal = this._pythonInstallationPath + '/' + packageName;
		return new Promise((resolve, reject) => {
			backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgDownloadPython(platformId, pythonDownloadUrl));
			fs.mkdirs(this._pythonInstallationPath, (err) => {
				if (err) {
					backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDirectoryError);
					reject(err);
				}

				let totalMegaBytes: number = undefined;
				let receivedBytes = 0;
				let printThreshold = 0.1;
				request.get(pythonDownloadUrl, { timeout: 20000 })
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
					})
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
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
								backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
								reject(err);
							}
						}
						decompress(pythonPackagePathLocal, this._pythonInstallationPath).then(files => {
							//Delete zip/tar file
							fs.unlink(pythonPackagePathLocal, (err) => {
								if (err) {
									backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
									reject(err);
								}
							});

							resolve();
						}).catch(err => {
							backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
							reject(err);
						});
					})
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
					});
			});
		});
	}

	private configurePackagePaths(): void {
		//Python source path up to bundle version
		let pythonSourcePath = this._usingExistingPython
			? this._pythonInstallationPath
			: path.join(this._pythonInstallationPath, constants.pythonBundleVersion);

		this._pythonPackageDir = path.join(pythonSourcePath, 'offlinePackages');

		// Update python paths and properties to reference user's local python.
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		this._pythonExecutable = JupyterServerInstallation.getPythonExePath(this._pythonInstallationPath, this._usingExistingPython);
		this.pythonBinPath = path.join(pythonSourcePath, pythonBinPathSuffix);

		this._usingConda = this.checkCondaExists();

		// Store paths to python libraries required to run jupyter.
		this.pythonEnvVarPath = process.env['PATH'];

		let delimiter = path.delimiter;
		this.pythonEnvVarPath = this.pythonBinPath + delimiter + this.pythonEnvVarPath;
		if (process.platform === constants.winPlatform) {
			let pythonScriptsPath = path.join(pythonSourcePath, 'Scripts');
			this.pythonEnvVarPath = pythonScriptsPath + delimiter + this.pythonEnvVarPath;

			if (this._usingConda) {
				this.pythonEnvVarPath = [
					path.join(pythonSourcePath, 'Library', 'mingw-w64', 'bin'),
					path.join(pythonSourcePath, 'Library', 'usr', 'bin'),
					path.join(pythonSourcePath, 'Library', 'bin'),
					path.join(pythonSourcePath, 'condabin'),
					this.pythonEnvVarPath
				].join(delimiter);
			}
		}

		// Delete existing Python variables in ADS to prevent conflict with other installs
		delete process.env['PYTHONPATH'];
		delete process.env['PYTHONSTARTUP'];
		delete process.env['PYTHONHOME'];

		// Store the executable options to run child processes with env var without interfering parent env var.
		let env = Object.assign({}, process.env);
		delete env['Path']; // Delete extra 'Path' variable for Windows, just in case.
		env['PATH'] = this.pythonEnvVarPath;
		this.execOptions = {
			env: env
		};
	}

	private isPythonRunning(pythonInstallPath: string): Promise<boolean> {
		let pythonExePath = JupyterServerInstallation.getPythonExePath(pythonInstallPath, this._usingExistingPython);
		return new Promise<boolean>(resolve => {
			fs.open(pythonExePath, 'r+', (err, fd) => {
				if (!err) {
					fs.close(fd, err => {
						this.apiWrapper.showErrorMessage(utils.getErrorMessage(err));
					});
					resolve(false);
				} else {
					resolve(err.code === 'EBUSY' || err.code === 'EPERM');
				}
			});
		});
	}

	/**
	 * Installs Python and associated dependencies to the specified directory.
	 * @param forceInstall Indicates whether an existing installation should be overwritten, if it exists.
	 * @param installationPath Optional parameter that specifies where to install python.
	 * The previous path (or the default) is used if a new path is not specified.
	 */
	public async startInstallProcess(forceInstall: boolean, installSettings?: { installPath: string, existingPython: boolean }): Promise<void> {
		let isPythonRunning = await this.isPythonRunning(installSettings ? installSettings.installPath : this._pythonInstallationPath);
		if (isPythonRunning) {
			return Promise.reject(msgPythonRunningError);
		}

		if (this._installInProgress) {
			return Promise.reject(msgPendingInstallError);
		}
		this._installInProgress = true;

		this._forceInstall = forceInstall;
		if (installSettings) {
			this._pythonInstallationPath = installSettings.installPath;
			this._usingExistingPython = installSettings.existingPython;
		}
		this.configurePackagePaths();

		let updateConfig = async () => {
			let notebookConfig = this.apiWrapper.getConfiguration(constants.notebookConfigKey);
			await notebookConfig.update(constants.pythonPathConfigKey, this._pythonInstallationPath, ConfigurationTarget.Global);
			await notebookConfig.update(constants.existingPythonConfigKey, this._usingExistingPython, ConfigurationTarget.Global);
		};
		let installReady = new Deferred<void>();
		if (!fs.existsSync(this._pythonExecutable) || this._forceInstall || this._usingExistingPython) {
			this.apiWrapper.startBackgroundOperation({
				displayName: msgTaskName,
				description: msgTaskName,
				isCancelable: false,
				operation: op => {
					this.installDependencies(op)
						.then(async () => {
							await updateConfig();
							installReady.resolve();
							this._installInProgress = false;
						})
						.catch(err => {
							let errorMsg = msgDependenciesInstallationFailed(utils.getErrorMessage(err));
							op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
							this.apiWrapper.showErrorMessage(errorMsg);
							installReady.reject(errorMsg);
							this._installInProgress = false;
						});
				}
			});
		} else {
			// Python executable already exists, but the path setting wasn't defined,
			// so update it here
			await updateConfig();
			installReady.resolve();
			this._installInProgress = false;
			this.apiWrapper.showInfoMessage(msgSkipPythonInstall);
		}
		return installReady.promise;
	}

	/**
	 * Opens a dialog for configuring the installation path for the Notebook Python dependencies.
	 */
	public async promptForPythonInstall(): Promise<void> {
		if (!JupyterServerInstallation.isPythonInstalled(this.apiWrapper)) {
			let pythonDialog = new ConfigurePythonDialog(this.apiWrapper, this);
			return pythonDialog.showDialog(true);
		}
	}

	private async installOfflinePipPackages(): Promise<void> {
		let installJupyterCommand: string;
		if (process.platform === constants.winPlatform) {
			let requirements = path.join(this._pythonPackageDir, 'requirements.txt');
			installJupyterCommand = `"${this._pythonExecutable}" -m pip install --no-index -r "${requirements}" --find-links "${this._pythonPackageDir}" --no-warn-script-location`;
		}

		if (installJupyterCommand) {
			this.outputChannel.show(true);
			this.outputChannel.appendLine(localize('msgInstallStart', "Installing required packages to run Notebooks..."));
			await this.executeCommand(installJupyterCommand);
			this.outputChannel.appendLine(localize('msgJupyterInstallDone', "... Jupyter installation complete."));
		} else {
			return Promise.resolve();
		}
	}

	private async installSparkMagic(doOnlineInstall: boolean): Promise<void> {
		let installSparkMagic: string;
		if (process.platform === constants.winPlatform || this._usingExistingPython) {
			let sparkWheel = path.join(this._pythonPackageDir, `sparkmagic-${constants.sparkMagicVersion}-py3-none-any.whl`);
			if (doOnlineInstall) {
				installSparkMagic = `"${this._pythonExecutable}" -m pip install "${sparkWheel}" --no-warn-script-location`;
			} else {
				installSparkMagic = `"${this._pythonExecutable}" -m pip install --no-index "${sparkWheel}" --find-links "${this._pythonPackageDir}" --no-warn-script-location`;
			}
		}

		if (installSparkMagic) {
			this.outputChannel.show(true);
			this.outputChannel.appendLine(localize('msgInstallingSpark', "Installing SparkMagic..."));
			await this.executeCommand(installSparkMagic);
		}
	}

	private async installPipPackages(): Promise<void> {
		this.outputChannel.show(true);
		this.outputChannel.appendLine(localize('msgInstallStart', "Installing required packages to run Notebooks..."));

		let installCommand = `"${this._pythonExecutable}" -m pip install jupyter pandas`;
		await this.executeCommand(installCommand);

		installCommand = `"${this._pythonExecutable}" -m pip install prose-codeaccelerator==1.3.0 --extra-index-url https://prose-python-packages.azurewebsites.net`;
		await this.executeCommand(installCommand);

		this.outputChannel.appendLine(localize('msgJupyterInstallDone', "... Jupyter installation complete."));
	}

	private async installCondaPackages(): Promise<void> {
		this.outputChannel.show(true);
		this.outputChannel.appendLine(localize('msgInstallStart', "Installing required packages to run Notebooks..."));

		let installCommand = `"${this.getCondaExePath()}" install -y jupyter pandas`;
		await this.executeCommand(installCommand);

		installCommand = `"${this._pythonExecutable}" -m pip install prose-codeaccelerator==1.3.0 --extra-index-url https://prose-python-packages.azurewebsites.net`;
		await this.executeCommand(installCommand);

		this.outputChannel.appendLine(localize('msgJupyterInstallDone', "... Jupyter installation complete."));
	}

	private async executeCommand(command: string): Promise<void> {
		await utils.executeStreamedCommand(command, { env: this.execOptions.env }, this.outputChannel);
	}

	public get pythonExecutable(): string {
		return this._pythonExecutable;
	}

	private getCondaExePath(): string {
		return path.join(this._pythonInstallationPath,
			process.platform === constants.winPlatform ? 'Scripts\\conda.exe' : 'bin/conda');
	}

	private checkCondaExists(): boolean {
		if (!this._usingExistingPython) {
			return false;
		}

		let condaExePath = this.getCondaExePath();
		return fs.existsSync(condaExePath);
	}

	/**
	 * Checks if a python executable exists at the "notebook.pythonPath" defined in the user's settings.
	 * @param apiWrapper An ApiWrapper to use when retrieving user settings info.
	 */
	public static isPythonInstalled(apiWrapper: ApiWrapper): boolean {
		// Don't use _pythonExecutable here, since it could be populated with a default value
		let pathSetting = JupyterServerInstallation.getPythonPathSetting(apiWrapper);
		if (!pathSetting) {
			return false;
		}

		let useExistingInstall = JupyterServerInstallation.getExistingPythonSetting(apiWrapper);
		let pythonExe = JupyterServerInstallation.getPythonExePath(pathSetting, useExistingInstall);
		return fs.existsSync(pythonExe);
	}

	/**
	 * Returns the Python installation path defined in "notebook.pythonPath" in the user's settings.
	 * Returns a default path if the setting is not defined.
	 * @param apiWrapper An ApiWrapper to use when retrieving user settings info.
	 */
	public static getPythonInstallPath(apiWrapper: ApiWrapper): string {
		let userPath = JupyterServerInstallation.getPythonPathSetting(apiWrapper);
		return userPath ? userPath : JupyterServerInstallation.DefaultPythonLocation;
	}

	public static getExistingPythonSetting(apiWrapper: ApiWrapper): boolean {
		let useExistingPython = false;
		if (apiWrapper) {
			let notebookConfig = apiWrapper.getConfiguration(constants.notebookConfigKey);
			if (notebookConfig) {
				useExistingPython = !!notebookConfig[constants.existingPythonConfigKey];
			}
		}
		return useExistingPython;
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

	/**
	 * Returns the folder containing the python executable under the path defined in
	 * "notebook.pythonPath" in the user's settings.
	 * @param apiWrapper An ApiWrapper to use when retrieving user settings info.
	 */
	public static getPythonBinPath(apiWrapper: ApiWrapper): string {
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		let useExistingInstall = JupyterServerInstallation.getExistingPythonSetting(apiWrapper);

		return path.join(
			JupyterServerInstallation.getPythonInstallPath(apiWrapper),
			useExistingInstall ? '' : constants.pythonBundleVersion,
			pythonBinPathSuffix);
	}

	public static getPythonExePath(pythonInstallPath: string, useExistingInstall: boolean): string {
		return path.join(
			pythonInstallPath,
			useExistingInstall ? '' : constants.pythonBundleVersion,
			process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
	}
}