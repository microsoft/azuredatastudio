/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { ExecOptions } from 'child_process';
import * as request from 'request';
import * as zip from 'adm-zip';
import * as tar from 'tar';

import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { Deferred } from '../common/promise';
import { ConfigurePythonWizard } from '../dialog/configurePython/configurePythonWizard';
import { IKernelInfo } from '../contracts/content';

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
const msgPythonRunningError = localize('msgPythonRunningError', "Cannot overwrite an existing Python installation while python is running. Please close any active notebooks before proceeding.");
const msgWaitingForInstall = localize('msgWaitingForInstall', "Another Python installation is currently in progress. Waiting for it to complete.");
const msgShutdownJupyterNotebookSessions = localize('msgShutdownNotebookSessions', "Active Python notebook sessions will be shutdown in order to update. Would you like to proceed now?");
function msgPythonVersionUpdatePrompt(pythonVersion: string): string { return localize('msgPythonVersionUpdatePrompt', "Python {0} is now available in Azure Data Studio. The current Python version (3.6.6) will be out of support in December 2021. Would you like to update to Python {0} now?", pythonVersion); }
function msgPythonVersionUpdateWarning(pythonVersion: string): string { return localize('msgPythonVersionUpdateWarning', "Python {0} will be installed and will replace Python 3.6.6. Some packages may no longer be compatible with the new version or may need to be reinstalled. A notebook will be created to help you reinstall all pip packages. Would you like to continue with the update now?", pythonVersion); }
function msgDependenciesInstallationFailed(errorMessage: string): string { return localize('msgDependenciesInstallationFailed', "Installing Notebook dependencies failed with error: {0}", errorMessage); }
function msgDownloadPython(platform: string, pythonDownloadUrl: string): string { return localize('msgDownloadPython', "Downloading local python for platform: {0} to {1}", platform, pythonDownloadUrl); }
function msgPackageRetrievalFailed(errorMessage: string): string { return localize('msgPackageRetrievalFailed', "Encountered an error when trying to retrieve list of installed packages: {0}", errorMessage); }
function msgGetPythonUserDirFailed(errorMessage: string): string { return localize('msgGetPythonUserDirFailed', "Encountered an error when getting Python user path: {0}", errorMessage); }

const yes = localize('yes', "Yes");
const no = localize('no', "No");
const dontAskAgain = localize('dontAskAgain', "Don't Ask Again");

export interface PythonInstallSettings {
	installPath: string;
	existingPython: boolean;
	packages: PythonPkgDetails[];
	packageUpgradeOnly?: boolean;
}
export interface IJupyterServerInstallation {
	/**
	 * Installs the specified packages using conda
	 * @param packages The list of packages to install
	 * @param useMinVersionDefault Whether we install each package as a min version (>=) or exact version (==) by default
	 */
	installCondaPackages(packages: PythonPkgDetails[], useMinVersionDefault: boolean): Promise<void>;
	configurePackagePaths(): Promise<void>;
	startInstallProcess(forceInstall: boolean, installSettings?: PythonInstallSettings): Promise<void>;
	getInstalledPipPackages(): Promise<PythonPkgDetails[]>;
	getInstalledCondaPackages(): Promise<PythonPkgDetails[]>;
	uninstallCondaPackages(packages: PythonPkgDetails[]): Promise<void>;
	usingConda: boolean;
	getCondaExePath(): string;
	executeBufferedCommand(command: string): Promise<string>;
	executeStreamedCommand(command: string): Promise<void>;
	/**
	 * Installs the specified packages using pip
	 * @param packages The list of packages to install
	 * @param useMinVersionDefault Whether we install each package as a min version (>=) or exact version (==) by default
	 */
	installPipPackages(packages: PythonPkgDetails[], useMinVersionDefault: boolean): Promise<void>;
	uninstallPipPackages(packages: PythonPkgDetails[]): Promise<void>;
	pythonExecutable: string;
	pythonInstallationPath: string;
	installedPythonVersion: string;
}

export const requiredJupyterPkg: PythonPkgDetails = {
	name: 'jupyter',
	version: '1.0.0'
};

export const requiredPowershellPkg: PythonPkgDetails = {
	name: 'powershell-kernel',
	version: '0.1.4'
};

export const requiredSparkPackages: PythonPkgDetails[] = [
	requiredJupyterPkg,
	{
		name: 'cryptography',
		version: '3.2.1',
		installExactVersion: true
	},
	{
		name: 'sparkmagic',
		version: '0.12.9'
	}, {
		name: 'pandas',
		version: '0.24.2'
	}
];

export class JupyterServerInstallation implements IJupyterServerInstallation {
	public extensionPath: string;
	public pythonBinPath: string;
	public outputChannel: vscode.OutputChannel;
	public pythonEnvVarPath: string;
	public execOptions: ExecOptions;

	private _pythonInstallationPath: string;
	private _pythonExecutable: string;
	private _usingExistingPython: boolean;
	private _usingConda: boolean;
	private _installedPythonVersion: string;

	private _upgradeInProcess: boolean = false;
	private _oldPythonExecutable: string | undefined;
	private _oldPythonInstallationPath: string | undefined;
	private _oldUserInstalledPipPackages: PythonPkgDetails[] = [];

	private _installInProgress: boolean;
	private _installCompletion: Deferred<void>;

	public static readonly DefaultPythonLocation = path.join(utils.getUserHome(), 'azuredatastudio-python');

	private _kernelSetupCache: Map<string, boolean>;
	private readonly _requiredKernelPackages: Map<string, PythonPkgDetails[]>;
	private readonly _requiredPackagesSet: Set<string>;

	private readonly _runningOnSAW: boolean;

	constructor(extensionPath: string, outputChannel: vscode.OutputChannel) {
		this.extensionPath = extensionPath;
		this.outputChannel = outputChannel;

		this._runningOnSAW = vscode.env.appName.toLowerCase().indexOf('saw') > 0;
		vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, 'notebook:runningOnSAW', this._runningOnSAW);

		if (this._runningOnSAW) {
			this._pythonInstallationPath = `${vscode.env.appRoot}\\ads-python`;
			this._usingExistingPython = true;
		} else {
			this._pythonInstallationPath = JupyterServerInstallation.getPythonInstallPath();
			this._usingExistingPython = JupyterServerInstallation.getExistingPythonSetting();
		}
		this._usingConda = false;
		this._installInProgress = false;

		this._kernelSetupCache = new Map<string, boolean>();
		this._requiredKernelPackages = new Map<string, PythonPkgDetails[]>();

		this._requiredKernelPackages.set(constants.python3DisplayName, [requiredJupyterPkg]);
		this._requiredKernelPackages.set(constants.powershellDisplayName, [requiredJupyterPkg, requiredPowershellPkg]);
		this._requiredKernelPackages.set(constants.pysparkDisplayName, requiredSparkPackages);
		this._requiredKernelPackages.set(constants.sparkScalaDisplayName, requiredSparkPackages);
		this._requiredKernelPackages.set(constants.sparkRDisplayName, requiredSparkPackages);

		let allPackages = requiredSparkPackages.concat(requiredPowershellPkg);
		this._requiredKernelPackages.set(constants.allKernelsName, allPackages);

		this._requiredPackagesSet = new Set<string>();
		allPackages.forEach(pkg => {
			this._requiredPackagesSet.add(pkg.name);
		});
	}

	private async installDependencies(backgroundOperation: azdata.BackgroundOperation, forceInstall: boolean, packages: PythonPkgDetails[]): Promise<void> {
		vscode.window.showInformationMessage(msgInstallPkgStart);

		this.outputChannel.show(true);
		this.outputChannel.appendLine(msgInstallPkgProgress);
		backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgInstallPkgProgress);

		try {
			let pythonExists = await utils.exists(this._pythonExecutable);
			let upgradePython = false;
			// Warn users that some packages may need to be reinstalled after updating Python versions
			if (!this._usingExistingPython && this._oldPythonExecutable && utils.compareVersions(await this.getInstalledPythonVersion(this._oldPythonExecutable), constants.pythonVersion) < 0) {
				upgradePython = await vscode.window.showInformationMessage(msgPythonVersionUpdateWarning(constants.pythonVersion), yes, no) === yes;
				if (upgradePython) {
					this._upgradeInProcess = true;
					if (await this.isPythonRunning(this._oldPythonExecutable)) {
						let proceed = await vscode.window.showInformationMessage(msgShutdownJupyterNotebookSessions, yes, no) === yes;
						if (!proceed) {
							throw Error('Python update failed due to active Python notebook sessions.');
						}
						// Temporarily change the pythonExecutable to the old Python path so that the
						// correct path is used to shutdown the old Python server.
						let newPythonExecutable = this._pythonExecutable;
						this._pythonExecutable = this._oldPythonExecutable;
						await vscode.commands.executeCommand('notebook.action.stopJupyterNotebookSessions');
						this._pythonExecutable = newPythonExecutable;
					}

					this._oldUserInstalledPipPackages = await this.getInstalledPipPackages(this._oldPythonExecutable, true);

					if (await this.getInstalledPythonVersion(this._oldPythonExecutable) === '3.6.6') {
						// Remove '0.0.1' from python executable path since the bundle version is removed from the path for ADS-Python 3.8.10+.
						this._pythonExecutable = path.join(this._pythonInstallationPath, process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
					}
				}
			}

			if (!pythonExists || forceInstall || upgradePython) {
				await this.installPythonPackage(backgroundOperation, this._usingExistingPython, this._pythonInstallationPath, this.outputChannel);
				// reinstall pip to make sure !pip command works on Windows
				if (!this._usingExistingPython && process.platform === constants.winPlatform) {
					let packages: PythonPkgDetails[] = await this.getInstalledPipPackages(this._pythonExecutable);
					let pip: PythonPkgDetails = packages.find(x => x.name === 'pip');
					let cmd = `"${this._pythonExecutable}" -m pip install --force-reinstall pip=="${pip.version}"`;
					await this.executeBufferedCommand(cmd);
				}
			}
			await this.upgradePythonPackages(forceInstall, packages);
		} catch (err) {
			this.outputChannel.appendLine(msgDependenciesInstallationFailed(utils.getErrorMessage(err)));
			throw err;
		}

		this.outputChannel.appendLine(msgInstallPkgFinish);
		backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, msgInstallPkgFinish);
		vscode.window.showInformationMessage(msgInstallPkgFinish);
	}

	private installPythonPackage(backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
		if (usingExistingPython) {
			return Promise.resolve();
		}

		let pythonVersion = constants.pythonVersion;
		let platformId = utils.getOSPlatformId();
		let packageName: string;
		let pythonDownloadUrl: string;

		let extension = process.platform === constants.winPlatform ? 'zip' : 'tar.gz';
		packageName = `python-${pythonVersion}-${platformId}.${extension}`;

		switch (process.platform) {
			case constants.winPlatform:
				pythonDownloadUrl = constants.pythonWindowsInstallUrl;
				break;
			case constants.macPlatform:
				pythonDownloadUrl = constants.pythonMacInstallUrl;
				break;
			default:
				// Default to linux
				pythonDownloadUrl = constants.pythonLinuxInstallUrl;
				break;
		}

		return new Promise((resolve, reject) => {
			let installPath = pythonInstallationPath;
			backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgDownloadPython(platformId, pythonDownloadUrl));
			fs.mkdirs(installPath, (err) => {
				if (err) {
					backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDirectoryError);
					return reject(err);
				}

				let totalMegaBytes: number = undefined;
				let receivedBytes = 0;
				let printThreshold = 0.1;
				let downloadRequest = request.get(pythonDownloadUrl, { timeout: 20000 })
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
					})
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
							return reject(response.statusMessage);
						}

						let totalBytes = parseInt(response.headers['content-length']);
						totalMegaBytes = totalBytes / (1024 * 1024);
						outputChannel.appendLine(`${msgPythonDownloadPending} (0 / ${totalMegaBytes.toFixed(2)} MB)`);
					})
					.on('data', (data) => {
						receivedBytes += data.length;
						if (totalMegaBytes) {
							let receivedMegaBytes = receivedBytes / (1024 * 1024);
							let percentage = receivedMegaBytes / totalMegaBytes;
							if (percentage >= printThreshold) {
								outputChannel.appendLine(`${msgPythonDownloadPending} (${receivedMegaBytes.toFixed(2)} / ${totalMegaBytes.toFixed(2)} MB)`);
								printThreshold += 0.1;
							}
						}
					});

				let pythonPackagePathLocal = path.join(installPath, packageName);
				downloadRequest.pipe(fs.createWriteStream(pythonPackagePathLocal))
					.on('close', async () => {
						//unpack python zip/tar file
						outputChannel.appendLine(msgPythonUnpackPending);
						if (process.platform === constants.winPlatform) {
							try {
								let zippedFile = new zip(pythonPackagePathLocal);
								zippedFile.extractAllTo(installPath);
							} catch (err) {
								backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
								reject(err);
							}
							// Delete zip file
							fs.unlink(pythonPackagePathLocal, (err) => {
								if (err) {
									backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
									reject(err);
								}
							});

							outputChannel.appendLine(msgPythonDownloadComplete);
							backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadComplete);
							resolve();
						} else {
							tar.extract({ file: pythonPackagePathLocal, cwd: installPath }).then(() => {
								// Delete tar file
								fs.unlink(pythonPackagePathLocal, (err) => {
									if (err) {
										backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
										reject(err);
									}
								});
								outputChannel.appendLine(msgPythonDownloadComplete);
								backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadComplete);
								resolve();
							}).catch(err => {
								backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
								reject(err);
							});
						}
					})
					.on('error', (downloadError) => {
						backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonDownloadError);
						reject(downloadError);
						downloadRequest.abort();
					});
			});
		});
	}

	public async configurePackagePaths(): Promise<void> {
		// Delete existing Python variables in ADS to prevent conflict with other installs
		delete process.env['PYTHONPATH'];
		delete process.env['PYTHONSTARTUP'];
		delete process.env['PYTHONHOME'];

		// Update python paths and properties to reference user's local python.
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		this._pythonExecutable = JupyterServerInstallation.getPythonExePath(this._pythonInstallationPath);
		this.pythonBinPath = path.join(this._pythonInstallationPath, pythonBinPathSuffix);

		this._usingConda = this.isCondaInstalled();

		// Store paths to python libraries required to run jupyter.
		this.pythonEnvVarPath = process.env['PATH'];

		let delimiter = path.delimiter;
		this.pythonEnvVarPath = this.pythonBinPath + delimiter + this.pythonEnvVarPath;
		if (process.platform === constants.winPlatform) {
			let pythonScriptsPath = path.join(this._pythonInstallationPath, 'Scripts');
			this.pythonEnvVarPath = pythonScriptsPath + delimiter + this.pythonEnvVarPath;

			if (this._usingConda) {
				this.pythonEnvVarPath = [
					path.join(this._pythonInstallationPath, 'Library', 'mingw-w64', 'bin'),
					path.join(this._pythonInstallationPath, 'Library', 'usr', 'bin'),
					path.join(this._pythonInstallationPath, 'Library', 'bin'),
					path.join(this._pythonInstallationPath, 'condabin'),
					this.pythonEnvVarPath
				].join(delimiter);
			}
		}

		// Skip adding user package directory on SAWs, since packages will already be included with ADS
		if (!this._runningOnSAW && await utils.exists(this._pythonExecutable)) {
			let pythonUserDir = await this.getPythonUserDir(this._pythonExecutable);
			if (pythonUserDir) {
				this.pythonEnvVarPath = pythonUserDir + delimiter + this.pythonEnvVarPath;
			}
			this._installedPythonVersion = await this.getInstalledPythonVersion(this._pythonExecutable);
		}

		// Store the executable options to run child processes with env var without interfering parent env var.
		let env = Object.assign({}, process.env);
		delete env['Path']; // Delete extra 'Path' variable for Windows, just in case.
		env['PATH'] = this.pythonEnvVarPath;

		this.execOptions = {
			env: env
		};
	}

	private async isPythonRunning(pythonExePath: string): Promise<boolean> {
		if (process.platform === constants.winPlatform) {
			let cmd = `powershell.exe -NoProfile -Command "& {Get-Process python | Where-Object {$_.Path -eq '${pythonExePath}'}}"`;
			let cmdResult: string;
			try {
				cmdResult = await this.executeBufferedCommand(cmd);
			} catch (err) {
				return false;
			}
			return cmdResult !== undefined && cmdResult.length > 0;
		}

		return false;
	}

	/**
	 * Installs Python and associated dependencies to the specified directory.
	 * @param forceInstall Indicates whether an existing installation should be overwritten, if it exists.
	 * @param installSettings Optional parameter that specifies where to install python, and whether the install targets an existing python install.
	 * The previous python path (or the default) is used if a new path is not specified.
	 */
	public async startInstallProcess(forceInstall: boolean, installSettings?: PythonInstallSettings): Promise<void> {
		if (!installSettings) {
			installSettings = {
				installPath: this._pythonInstallationPath,
				existingPython: this._usingExistingPython,
				packages: this.getRequiredPackagesForKernel(constants.python3DisplayName)
			};
		}

		// Check if Python is running before attempting to overwrite the installation.
		// This step is skipped when using an existing installation or when upgrading
		// packages, since those cases wouldn't overwrite the installation.
		if (!installSettings.existingPython && !installSettings.packageUpgradeOnly) {
			let pythonExePath = JupyterServerInstallation.getPythonExePath(installSettings.installPath);
			let isPythonRunning = await this.isPythonRunning(pythonExePath);
			if (isPythonRunning) {
				return Promise.reject(msgPythonRunningError);
			}
		}

		if (this._installInProgress) {
			vscode.window.showInformationMessage(msgWaitingForInstall);
			return this._installCompletion.promise;
		}

		this._installInProgress = true;
		this._installCompletion = new Deferred<void>();

		this._pythonInstallationPath = installSettings.installPath;
		this._usingExistingPython = installSettings.existingPython;
		await this.configurePackagePaths();

		azdata.tasks.startBackgroundOperation({
			displayName: msgTaskName,
			description: msgTaskName,
			isCancelable: false,
			operation: op => {
				this.installDependencies(op, forceInstall, installSettings.packages)
					.then(async () => {
						let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
						await notebookConfig.update(constants.pythonPathConfigKey, this._pythonInstallationPath, vscode.ConfigurationTarget.Global);
						await notebookConfig.update(constants.existingPythonConfigKey, this._usingExistingPython, vscode.ConfigurationTarget.Global);
						await this.configurePackagePaths();

						this._installCompletion.resolve();
						this._installInProgress = false;
						if (this._upgradeInProcess) {
							// Pass in false for restartJupyterServer parameter since the jupyter server has already been shutdown
							// when removing the old Python version on Windows.
							if (process.platform === constants.winPlatform) {
								await vscode.commands.executeCommand('notebook.action.restartJupyterNotebookSessions', false);
							} else {
								await vscode.commands.executeCommand('notebook.action.restartJupyterNotebookSessions');
							}
							if (this._oldUserInstalledPipPackages.length !== 0) {
								await this.createInstallPipPackagesHelpNotebook(this._oldUserInstalledPipPackages);
							}

							await fs.remove(this._oldPythonInstallationPath);
							this._upgradeInProcess = false;
						} else if (!installSettings.packageUpgradeOnly) {
							await vscode.commands.executeCommand('notebook.action.restartJupyterNotebookSessions');
						}
					})
					.catch(err => {
						let errorMsg = msgDependenciesInstallationFailed(utils.getErrorMessage(err));
						op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
						this._installCompletion.reject(errorMsg);
						this._installInProgress = false;
					});
			}
		});
		return this._installCompletion.promise;
	}

	/**
	 * Opens a dialog for configuring the installation path for the Notebook Python dependencies.
	 */
	public async promptForPythonInstall(kernelDisplayName: string): Promise<void> {
		if (this._runningOnSAW) {
			return Promise.resolve();
		}
		if (this._installInProgress) {
			vscode.window.showInformationMessage(msgWaitingForInstall);
			return this._installCompletion.promise;
		}

		let isPythonInstalled = JupyterServerInstallation.isPythonInstalled();

		// If the latest version of ADS-Python is not installed, then prompt the user to upgrade
		if (isPythonInstalled && !this._usingExistingPython && utils.compareVersions(await this.getInstalledPythonVersion(this._pythonExecutable), constants.pythonVersion) < 0) {
			this.promptUserForPythonUpgrade();
		}

		let areRequiredPackagesInstalled = await this.areRequiredPackagesInstalled(kernelDisplayName);
		if (!isPythonInstalled || !areRequiredPackagesInstalled) {
			let pythonWizard = new ConfigurePythonWizard(this);
			await pythonWizard.start(kernelDisplayName, true);
			return pythonWizard.setupComplete.then(() => {
				this._kernelSetupCache.set(kernelDisplayName, true);
			});
		}
	}

	private async promptUserForPythonUpgrade(): Promise<void> {
		let notebookConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		if (notebookConfig && notebookConfig[constants.dontPromptPythonUpdate]) {
			return;
		}

		let response = await vscode.window.showInformationMessage(msgPythonVersionUpdatePrompt(constants.pythonVersion), yes, no, dontAskAgain);
		if (response === yes) {
			this._oldPythonInstallationPath = path.join(this._pythonInstallationPath, '0.0.1');
			this._oldPythonExecutable = this._pythonExecutable;
			vscode.commands.executeCommand(constants.jupyterConfigurePython);
		} else if (response === dontAskAgain) {
			await notebookConfig.update(constants.dontPromptPythonUpdate, true, vscode.ConfigurationTarget.Global);
		}
	}

	private async areRequiredPackagesInstalled(kernelDisplayName: string): Promise<boolean> {
		if (this._kernelSetupCache.get(kernelDisplayName)) {
			return true;
		}

		let installedPackages = await this.getInstalledPipPackages();
		let installedPackageMap = new Map<string, string>();
		installedPackages.forEach(pkg => {
			installedPackageMap.set(pkg.name, pkg.version);
		});
		let requiredPackages = this.getRequiredPackagesForKernel(kernelDisplayName);
		for (let pkg of requiredPackages) {
			let installedVersion = installedPackageMap.get(pkg.name);
			if (!installedVersion || utils.compareVersions(installedVersion, pkg.version) < 0) {
				return false;
			}
		}
		this._kernelSetupCache.set(kernelDisplayName, true);
		return true;
	}

	private async upgradePythonPackages(forceInstall: boolean, packages: PythonPkgDetails[]): Promise<void> {
		let packagesToInstall: PythonPkgDetails[];
		if (forceInstall) {
			packagesToInstall = packages;
		} else {
			packagesToInstall = [];

			let installedPipPackages = await this.getInstalledPipPackages();
			let pipVersionMap = new Map<string, string>();
			installedPipPackages.forEach(pkg => pipVersionMap.set(pkg.name, pkg.version));

			packages.forEach(pkg => {
				let installedPkgVersion = pipVersionMap.get(pkg.name);
				if (!installedPkgVersion || utils.compareVersions(installedPkgVersion, pkg.version) < 0) {
					packagesToInstall.push(pkg);
				}
			});
		}

		if (packagesToInstall.length > 0) {
			// Always install generic packages with pip, since conda may not have them (like powershell-kernel).
			await this.installPipPackages(packagesToInstall, true);
		}
	}

	public async getInstalledPipPackages(pythonExePath?: string, checkUserPackages: boolean = false): Promise<PythonPkgDetails[]> {
		try {
			if (pythonExePath) {
				if (!fs.existsSync(pythonExePath)) {
					return [];
				}
			} else if (!JupyterServerInstallation.isPythonInstalled()) {
				return [];
			}

			let cmd = `"${pythonExePath ?? this.pythonExecutable}" -m pip list --format=json`;
			if (checkUserPackages) {
				cmd = cmd.concat(' --user');
			}
			let packagesInfo = await this.executeBufferedCommand(cmd);
			let packages: PythonPkgDetails[] = [];
			if (packagesInfo) {
				let parsedResult = <PythonPkgDetails[]>JSON.parse(packagesInfo);
				if (parsedResult) {
					packages = parsedResult;
				}
			}
			return packages;
		}
		catch (err) {
			this.outputChannel.appendLine(msgPackageRetrievalFailed(utils.getErrorMessage(err)));
			return [];
		}
	}

	public installPipPackages(packages: PythonPkgDetails[], useMinVersionDefault: boolean): Promise<void> {
		if (!packages || packages.length === 0) {
			return Promise.resolve();
		}

		let versionSpecifierDefault = useMinVersionDefault ? '>=' : '==';
		let packagesStr = packages.map(pkg => {
			const pkgVersionSpecifier = pkg.installExactVersion ? '==' : versionSpecifierDefault;
			return `"${pkg.name}${pkgVersionSpecifier}${pkg.version}"`;
		}).join(' ');
		let cmd = `"${this.pythonExecutable}" -m pip install --user ${packagesStr}`;
		return this.executeStreamedCommand(cmd);
	}

	public uninstallPipPackages(packages: PythonPkgDetails[]): Promise<void> {
		for (let pkg of packages) {
			if (this._requiredPackagesSet.has(pkg.name)) {
				this._kernelSetupCache.clear();
				break;
			}
		}

		let packagesStr = packages.map(pkg => `"${pkg.name}==${pkg.version}"`).join(' ');
		let cmd = `"${this.pythonExecutable}" -m pip uninstall -y ${packagesStr}`;
		return this.executeStreamedCommand(cmd);
	}

	public async getInstalledCondaPackages(): Promise<PythonPkgDetails[]> {
		try {
			if (!this.isCondaInstalled()) {
				return [];
			}

			let condaExe = this.getCondaExePath();
			let cmd = `"${condaExe}" list --json`;
			let packagesInfo = await this.executeBufferedCommand(cmd);

			let packages: PythonPkgDetails[] = [];
			if (packagesInfo) {
				let parsedResult = <PythonPkgDetails[]>JSON.parse(packagesInfo);
				if (parsedResult) {
					packages = parsedResult.filter(pkg => pkg && pkg.channel && pkg.channel !== 'pypi');
				}
			}
			return packages;
		}
		catch (err) {
			this.outputChannel.appendLine(msgPackageRetrievalFailed(utils.getErrorMessage(err)));
			return [];
		}
	}

	public installCondaPackages(packages: PythonPkgDetails[], useMinVersionDefault: boolean): Promise<void> {
		if (!packages || packages.length === 0) {
			return Promise.resolve();
		}

		let versionSpecifierDefault = useMinVersionDefault ? '>=' : '==';
		let packagesStr = packages.map(pkg => {
			const pkgVersionSpecifier = pkg.installExactVersion ? '==' : versionSpecifierDefault;
			return `"${pkg.name}${pkgVersionSpecifier}${pkg.version}"`;
		}).join(' ');
		let condaExe = this.getCondaExePath();
		let cmd = `"${condaExe}" install -c conda-forge -y ${packagesStr}`;
		return this.executeStreamedCommand(cmd);
	}

	public uninstallCondaPackages(packages: PythonPkgDetails[]): Promise<void> {
		for (let pkg of packages) {
			if (this._requiredPackagesSet.has(pkg.name)) {
				this._kernelSetupCache.clear();
				break;
			}
		}

		let condaExe = this.getCondaExePath();
		let packagesStr = packages.map(pkg => `"${pkg.name}==${pkg.version}"`).join(' ');
		let cmd = `"${condaExe}" uninstall -y ${packagesStr}`;
		return this.executeStreamedCommand(cmd);
	}

	public async executeStreamedCommand(command: string): Promise<void> {
		await utils.executeStreamedCommand(command, { env: this.execOptions.env }, this.outputChannel);
	}

	public async executeBufferedCommand(command: string): Promise<string> {
		return await utils.executeBufferedCommand(command, { env: this.execOptions.env });
	}

	public get pythonExecutable(): string {
		return this._pythonExecutable;
	}

	public getCondaExePath(): string {
		return path.join(this._pythonInstallationPath,
			process.platform === constants.winPlatform ? 'Scripts\\conda.exe' : 'bin/conda');
	}

	/**
	 * Returns Python installation path
	 */
	public get pythonInstallationPath(): string {
		return this._pythonInstallationPath;
	}

	public get usingConda(): boolean {
		return this._usingConda;
	}

	public get installedPythonVersion(): string {
		return this._installedPythonVersion;
	}

	private isCondaInstalled(): boolean {
		let condaExePath = this.getCondaExePath();
		// eslint-disable-next-line no-sync
		return fs.existsSync(condaExePath);
	}

	/**
	 * Checks if a python executable exists at the "notebook.pythonPath" defined in the user's settings.
	 */
	public static isPythonInstalled(): boolean {
		// Don't use _pythonExecutable here, since it could be populated with a default value
		let pathSetting = JupyterServerInstallation.getPythonPathSetting();
		if (!pathSetting) {
			return false;
		}

		let pythonExe = JupyterServerInstallation.getPythonExePath(pathSetting);
		// eslint-disable-next-line no-sync
		return fs.existsSync(pythonExe);
	}

	/**
	 * Returns the Python installation path defined in "notebook.pythonPath" in the user's settings.
	 * Returns a default path if the setting is not defined.
	 */
	public static getPythonInstallPath(): string {
		let userPath = JupyterServerInstallation.getPythonPathSetting();
		return userPath ? userPath : JupyterServerInstallation.DefaultPythonLocation;
	}

	public static getExistingPythonSetting(): boolean {
		let useExistingPython = false;
		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		if (notebookConfig) {
			useExistingPython = !!notebookConfig[constants.existingPythonConfigKey];
		}
		return useExistingPython;
	}

	public static getPythonPathSetting(): string {
		let path = undefined;
		let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
		if (notebookConfig) {
			let configPythonPath = notebookConfig[constants.pythonPathConfigKey];
			// eslint-disable-next-line no-sync
			if (configPythonPath && fs.existsSync(configPythonPath)) {
				path = configPythonPath;
			}
		}
		return path;
	}

	public static getPythonExePath(pythonInstallPath: string): string {
		// The bundle version (0.0.1) is removed from the path for ADS-Python 3.8.10+.
		// Only ADS-Python 3.6.6 contains the bundle version in the path.
		let oldPythonPath = path.join(
			pythonInstallPath,
			'0.0.1',
			process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
		let newPythonPath = path.join(
			pythonInstallPath,
			process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');

		// Note: If Python exists in both paths (which can happen if the user chose not to remove Python 3.6 when upgrading),
		// then we want to default to using the newer Python version.
		if (!fs.existsSync(newPythonPath) && !fs.existsSync(oldPythonPath) || fs.existsSync(newPythonPath)) {
			return newPythonPath;
		}
		// If Python only exists in the old path then return the old path.
		// This is for users who are still using Python 3.6
		return oldPythonPath;
	}

	private async getPythonUserDir(pythonExecutable: string): Promise<string> {
		try {
			let sitePath: string;
			if (process.platform === constants.winPlatform) {
				sitePath = 'USER_SITE';
			} else {
				sitePath = 'USER_BASE';
			}
			let cmd = `"${pythonExecutable}" -c "import site;print(site.${sitePath})"`;

			let packagesDir = await utils.executeBufferedCommand(cmd, {});
			if (packagesDir && packagesDir.length > 0) {
				packagesDir = packagesDir.trim();
				if (process.platform === constants.winPlatform) {
					packagesDir = path.resolve(path.join(packagesDir, '..', 'Scripts'));
				} else {
					packagesDir = path.join(packagesDir, 'bin');
				}

				return packagesDir;
			}
		} catch (err) {
			this.outputChannel.appendLine(msgGetPythonUserDirFailed(utils.getErrorMessage(err)));
		}

		return undefined;
	}

	private async getInstalledPythonVersion(pythonExecutable: string): Promise<string> {
		let cmd = `"${pythonExecutable}" -c "import platform;print(platform.python_version())"`;
		let version = await utils.executeBufferedCommand(cmd, {});
		return version?.trim() ?? '';
	}

	public getRequiredPackagesForKernel(kernelName: string): PythonPkgDetails[] {
		return this._requiredKernelPackages.get(kernelName) ?? [];
	}

	public get runningOnSaw(): boolean {
		return this._runningOnSAW;
	}

	public async updateKernelSpecPaths(kernelsFolder: string): Promise<void> {
		if (!this._runningOnSAW) {
			return;
		}
		let fileNames = await fs.readdir(kernelsFolder);
		let filePaths = fileNames.map(name => path.join(kernelsFolder, name));
		let fileStats = await Promise.all(filePaths.map(path => fs.stat(path)));
		let folderPaths = filePaths.filter((value, index) => value && fileStats[index].isDirectory());
		let kernelFiles = folderPaths.map(folder => path.join(folder, 'kernel.json'));
		await Promise.all(kernelFiles.map(file => this.updateKernelSpecPath(file)));
	}

	private async updateKernelSpecPath(kernelPath: string): Promise<void> {
		let fileContents = await fs.readFile(kernelPath);
		let kernelSpec = <IKernelInfo>JSON.parse(fileContents.toString());
		kernelSpec.argv = kernelSpec.argv?.map(arg => arg.replace('{ADS_PYTHONDIR}', this._pythonInstallationPath));
		await fs.writeFile(kernelPath, JSON.stringify(kernelSpec, undefined, '\t'));
	}

	private async createInstallPipPackagesHelpNotebook(userInstalledPipPackages: PythonPkgDetails[]): Promise<void> {
		let packagesList: string[] = userInstalledPipPackages.map(pkg => { return pkg.name; });
		// Filter out prose-codeaccelerator since we no longer ship it and it is not on Pypi.
		packagesList = packagesList.filter(pkg => pkg !== 'prose-codeaccelerator');
		let installPackagesCode = `import sys\n!{sys.executable} -m pip install --user ${packagesList.join(' ')}`;
		let initialContent: azdata.nb.INotebookContents = {
			cells: [{
				cell_type: 'markdown',
				source: ['# Install Pip Packages\n\nThis notebook will help you reinstall the pip packages you were previously using so that they can be used with Python 3.8.\n\n**Note:** Some packages may have a dependency on Python 3.6 and will not work with Python 3.8.\n\nRun the following code cell after Python 3.8 installation is complete.'],
			}, {
				cell_type: 'code',
				source: [installPackagesCode],
			}],
			metadata: {
				kernelspec: {
					name: 'python3',
					language: 'python3',
					display_name: 'Python 3'
				},
				language_info: {
					name: 'python3'
				}
			},
			nbformat: 4,
			nbformat_minor: 5
		};

		await vscode.commands.executeCommand('_notebook.command.new', {
			initialContent: JSON.stringify(initialContent),
			defaultKernel: 'Python 3'
		});
	}
}

export interface PythonPkgDetails {
	name: string;
	version: string;
	channel?: string;
	/**
	 * Whether to always install the exact version of the package (==)
	 */
	installExactVersion?: boolean
}

export interface PipPackageOverview {
	name: string;
	versions: string[];
	summary: string;
}
