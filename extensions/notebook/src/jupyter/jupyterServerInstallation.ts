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
import { IPrompter, IQuestion, confirm } from '../prompts/question';
import CodeAdapter from '../prompts/adapter';
import { ConfigurePythonDialog } from '../dialog/configurePython/configurePythonDialog';

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
function msgDependenciesInstallationFailed(errorMessage: string): string { return localize('msgDependenciesInstallationFailed', "Installing Notebook dependencies failed with error: {0}", errorMessage); }
function msgDownloadPython(platform: string, pythonDownloadUrl: string): string { return localize('msgDownloadPython', "Downloading local python for platform: {0} to {1}", platform, pythonDownloadUrl); }
function msgPackageRetrievalFailed(errorMessage: string): string { return localize('msgPackageRetrievalFailed', "Encountered an error when trying to retrieve list of installed packages: {0}", errorMessage); }

export interface PythonInstallSettings {
	installPath: string;
	existingPython: boolean;
	specificPackages?: PythonPkgDetails[];
}
export interface IJupyterServerInstallation {
	installCondaPackages(packages: PythonPkgDetails[], useMinVersion: boolean): Promise<void>;
	configurePackagePaths(): Promise<void>;
	startInstallProcess(forceInstall: boolean, installSettings?: PythonInstallSettings): Promise<void>;
	getInstalledPipPackages(): Promise<PythonPkgDetails[]>;
	getInstalledCondaPackages(): Promise<PythonPkgDetails[]>;
	uninstallCondaPackages(packages: PythonPkgDetails[]): Promise<void>;
	usingConda: boolean;
	getCondaExePath(): string;
	executeBufferedCommand(command: string): Promise<string>;
	executeStreamedCommand(command: string): Promise<void>;
	installPipPackages(packages: PythonPkgDetails[], useMinVersion: boolean): Promise<void>;
	uninstallPipPackages(packages: PythonPkgDetails[]): Promise<void>;
	pythonExecutable: string;
	pythonInstallationPath: string;
	installPythonPackage(backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel): Promise<void>;
}
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

	private _installInProgress: boolean;
	private _installCompletion: Deferred<void>;

	public static readonly DefaultPythonLocation = path.join(utils.getUserHome(), 'azuredatastudio-python');

	private _prompter: IPrompter;

	private readonly _commonPackages: PythonPkgDetails[] = [
		{
			name: 'jupyter',
			version: '1.0.0'
		}, {
			name: 'pandas',
			version: '0.24.2'
		}, {
			name: 'sparkmagic',
			version: '0.12.9'
		}
	];

	private readonly _commonPipPackages: PythonPkgDetails[] = [
		{
			name: 'prose-codeaccelerator',
			version: '1.3.0'
		}, {
			name: 'powershell-kernel',
			version: '0.1.3'
		}
	];

	private readonly _expectedPythonPackages = this._commonPackages.concat(this._commonPipPackages);
	private readonly _expectedCondaPipPackages = this._commonPipPackages;
	private readonly _expectedCondaPackages: PythonPkgDetails[];

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

		this._prompter = new CodeAdapter();

		if (process.platform !== constants.winPlatform) {
			this._expectedCondaPackages = this._commonPackages.concat([{ name: 'pykerberos', version: '1.2.1' }]);
		} else {
			this._expectedCondaPackages = this._commonPackages;
		}

		this._kernelSetupCache = new Map<string, boolean>();
		this._requiredKernelPackages = new Map<string, PythonPkgDetails[]>();

		let jupyterPkg = {
			name: 'jupyter',
			version: '1.0.0'
		};
		this._requiredKernelPackages.set(constants.python3DisplayName, [jupyterPkg]);

		let powershellPkg = {
			name: 'powershell-kernel',
			version: '0.1.3'
		};
		this._requiredKernelPackages.set(constants.powershellDisplayName, [jupyterPkg, powershellPkg]);

		let sparkPackages = [
			jupyterPkg,
			{
				name: 'sparkmagic',
				version: '0.12.9'
			}, {
				name: 'pandas',
				version: '0.24.2'
			}, {
				name: 'prose-codeaccelerator',
				version: '1.3.0'
			}];
		this._requiredKernelPackages.set(constants.pysparkDisplayName, sparkPackages);
		this._requiredKernelPackages.set(constants.sparkScalaDisplayName, sparkPackages);
		this._requiredKernelPackages.set(constants.sparkRDisplayName, sparkPackages);

		let allPackages = sparkPackages.concat(powershellPkg);
		this._requiredKernelPackages.set(constants.allKernelsName, allPackages);

		this._requiredPackagesSet = new Set<string>();
		allPackages.forEach(pkg => {
			this._requiredPackagesSet.add(pkg.name);
		});
	}

	private async installDependencies(backgroundOperation: azdata.BackgroundOperation, forceInstall: boolean, specificPackages?: PythonPkgDetails[]): Promise<void> {
		vscode.window.showInformationMessage(msgInstallPkgStart);

		this.outputChannel.show(true);
		this.outputChannel.appendLine(msgInstallPkgProgress);
		backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgInstallPkgProgress);

		try {
			let pythonExists = await utils.exists(this._pythonExecutable);
			if (!pythonExists || forceInstall) {
				await this.installPythonPackage(backgroundOperation, this._usingExistingPython, this._pythonInstallationPath, this.outputChannel);
			}
			await this.upgradePythonPackages(false, forceInstall, specificPackages);
		} catch (err) {
			this.outputChannel.appendLine(msgDependenciesInstallationFailed(utils.getErrorMessage(err)));
			throw err;
		}

		this.outputChannel.appendLine(msgInstallPkgFinish);
		backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, msgInstallPkgFinish);
		vscode.window.showInformationMessage(msgInstallPkgFinish);
	}

	public installPythonPackage(backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel): Promise<void> {
		if (usingExistingPython) {
			return Promise.resolve();
		}

		let bundleVersion = constants.pythonBundleVersion;
		let pythonVersion = constants.pythonVersion;
		let platformId = utils.getOSPlatformId();
		let packageName: string;
		let pythonDownloadUrl: string;

		let extension = process.platform === constants.winPlatform ? 'zip' : 'tar.gz';
		packageName = `python-${pythonVersion}-${platformId}-${bundleVersion}.${extension}`;

		switch (utils.getOSPlatform()) {
			case utils.Platform.Windows:
				pythonDownloadUrl = constants.pythonWindowsInstallUrl;
				break;
			case utils.Platform.Mac:
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
						let pythonSourcePath = path.join(installPath, constants.pythonBundleVersion);
						if (await utils.exists(pythonSourcePath)) {
							try {
								// eslint-disable-next-line no-sync
								fs.removeSync(pythonSourcePath);
							} catch (err) {
								backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgPythonUnpackError);
								return reject(err);
							}
						}
						if (utils.getOSPlatform() === utils.Platform.Windows) {
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
		//Python source path up to bundle version
		let pythonSourcePath = this._usingExistingPython
			? this._pythonInstallationPath
			: path.join(this._pythonInstallationPath, constants.pythonBundleVersion);

		// Update python paths and properties to reference user's local python.
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		this._pythonExecutable = JupyterServerInstallation.getPythonExePath(this._pythonInstallationPath, this._usingExistingPython);
		this.pythonBinPath = path.join(pythonSourcePath, pythonBinPathSuffix);

		this._usingConda = this.isCondaInstalled();

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

		if (await utils.exists(this._pythonExecutable)) {
			let pythonUserDir = await this.getPythonUserDir(this._pythonExecutable);
			if (pythonUserDir) {
				this.pythonEnvVarPath = pythonUserDir + delimiter + this.pythonEnvVarPath;
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
				existingPython: this._usingExistingPython
			};
		}

		// Check if Python is running before attempting to overwrite the installation.
		// This step is skipped when using an existing installation, since we only add
		// extra packages in that case and don't modify the install itself.
		if (!installSettings.existingPython) {
			let pythonExePath = JupyterServerInstallation.getPythonExePath(installSettings.installPath, false);
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
				this.installDependencies(op, forceInstall, installSettings.specificPackages)
					.then(async () => {
						let notebookConfig = vscode.workspace.getConfiguration(constants.notebookConfigKey);
						await notebookConfig.update(constants.pythonPathConfigKey, this._pythonInstallationPath, vscode.ConfigurationTarget.Global);
						await notebookConfig.update(constants.existingPythonConfigKey, this._usingExistingPython, vscode.ConfigurationTarget.Global);
						await this.configurePackagePaths();

						this._installCompletion.resolve();
						this._installInProgress = false;
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
		let areRequiredPackagesInstalled = await this.areRequiredPackagesInstalled(kernelDisplayName);
		if (!isPythonInstalled || !areRequiredPackagesInstalled) {
			if (this.previewFeaturesEnabled) {
				let pythonWizard = new ConfigurePythonWizard(this);
				await pythonWizard.start(kernelDisplayName, true);
				return pythonWizard.setupComplete.then(() => {
					this._kernelSetupCache.set(kernelDisplayName, true);
				});
			} else {
				let pythonDialog = new ConfigurePythonDialog(this);
				return pythonDialog.showDialog(true);
			}
		}
	}

	/**
	 * Prompts user to upgrade certain python packages if they're below the minimum expected version.
	 */
	public async promptForPackageUpgrade(kernelName: string): Promise<void> {
		if (this._runningOnSAW) {
			return Promise.resolve();
		}
		if (this._installInProgress) {
			vscode.window.showInformationMessage(msgWaitingForInstall);
			return this._installCompletion.promise;
		}

		let requiredPackages: PythonPkgDetails[];
		if (this.previewFeaturesEnabled) {
			if (this._kernelSetupCache.get(kernelName)) {
				return;
			}
			requiredPackages = this.getRequiredPackagesForKernel(kernelName);
		}

		this._installInProgress = true;
		this._installCompletion = new Deferred<void>();
		this.upgradePythonPackages(true, false, requiredPackages)
			.then(() => {
				this._installCompletion.resolve();
				this._installInProgress = false;
				this._kernelSetupCache.set(kernelName, true);
			})
			.catch(err => {
				let errorMsg = msgDependenciesInstallationFailed(utils.getErrorMessage(err));
				this._installCompletion.reject(errorMsg);
				this._installInProgress = false;
			});
		return this._installCompletion.promise;
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
			if (!installedVersion || utils.comparePackageVersions(installedVersion, pkg.version) < 0) {
				return false;
			}
		}
		this._kernelSetupCache.set(kernelDisplayName, true);
		return true;
	}

	private async upgradePythonPackages(promptForUpgrade: boolean, forceInstall: boolean, specificPackages?: PythonPkgDetails[]): Promise<void> {
		let expectedCondaPackages: PythonPkgDetails[];
		let expectedPipPackages: PythonPkgDetails[];
		if (specificPackages) {
			// Always install generic packages with pip, since conda may not have them.
			expectedCondaPackages = [];
			expectedPipPackages = specificPackages;
		} else if (this._usingConda) {
			expectedCondaPackages = this._expectedCondaPackages;
			expectedPipPackages = this._expectedCondaPipPackages;
		} else {
			expectedCondaPackages = [];
			expectedPipPackages = this._expectedPythonPackages;
		}

		let condaPackagesToInstall: PythonPkgDetails[];
		let pipPackagesToInstall: PythonPkgDetails[];
		if (forceInstall) {
			condaPackagesToInstall = expectedCondaPackages;
			pipPackagesToInstall = expectedPipPackages;
		} else {
			condaPackagesToInstall = [];
			pipPackagesToInstall = [];

			// Conda packages
			if (this._usingConda) {
				let installedCondaPackages = await this.getInstalledCondaPackages();
				let condaVersionMap = new Map<string, string>();
				installedCondaPackages.forEach(pkg => condaVersionMap.set(pkg.name, pkg.version));

				expectedCondaPackages.forEach(expectedPkg => {
					let installedPkgVersion = condaVersionMap.get(expectedPkg.name);
					if (!installedPkgVersion || utils.comparePackageVersions(installedPkgVersion, expectedPkg.version) < 0) {
						condaPackagesToInstall.push(expectedPkg);
					}
				});
			}

			// Pip packages
			let installedPipPackages = await this.getInstalledPipPackages();
			let pipVersionMap = new Map<string, string>();
			installedPipPackages.forEach(pkg => pipVersionMap.set(pkg.name, pkg.version));

			expectedPipPackages.forEach(expectedPkg => {
				let installedPkgVersion = pipVersionMap.get(expectedPkg.name);
				if (!installedPkgVersion || utils.comparePackageVersions(installedPkgVersion, expectedPkg.version) < 0) {
					pipPackagesToInstall.push(expectedPkg);
				}
			});
		}

		if (condaPackagesToInstall.length > 0 || pipPackagesToInstall.length > 0) {
			let doUpgrade: boolean;
			if (promptForUpgrade) {
				doUpgrade = await this._prompter.promptSingle<boolean>(<IQuestion>{
					type: confirm,
					message: localize('confirmPackageUpgrade', "Some required python packages need to be installed. Would you like to install them now?"),
					default: true
				});
				if (!doUpgrade) {
					throw new Error(localize('configurePython.packageInstallDeclined', "Package installation was declined."));
				}
			} else {
				doUpgrade = true;
			}

			if (doUpgrade) {
				let installPromise = new Promise(async (resolve, reject) => {
					try {
						if (this._usingConda) {
							await this.installCondaPackages(condaPackagesToInstall, true);
						}
						await this.installPipPackages(pipPackagesToInstall, true);
						resolve();
					} catch (err) {
						reject(err);
					}
				});

				if (promptForUpgrade) {
					let packagesStr = condaPackagesToInstall.concat(pipPackagesToInstall).map(pkg => {
						return `${pkg.name}>=${pkg.version}`;
					}).join(' ');
					let taskName = localize('upgradePackages.pipInstall',
						"Installing {0}",
						packagesStr);

					let backgroundTaskComplete = new Deferred<void>();
					azdata.tasks.startBackgroundOperation({
						displayName: taskName,
						description: taskName,
						isCancelable: false,
						operation: async op => {
							try {
								await installPromise;
								op.updateStatus(azdata.TaskStatus.Succeeded);
								backgroundTaskComplete.resolve();
							} catch (err) {
								let errorMsg = utils.getErrorMessage(err);
								op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
								backgroundTaskComplete.reject(errorMsg);
							}
						}
					});
					await backgroundTaskComplete.promise;
				} else {
					await installPromise;
				}
			}
		}
	}

	public async getInstalledPipPackages(pythonExePath?: string): Promise<PythonPkgDetails[]> {
		try {
			if (pythonExePath) {
				if (!fs.existsSync(pythonExePath)) {
					return [];
				}
			} else if (!JupyterServerInstallation.isPythonInstalled()) {
				return [];
			}

			let cmd = `"${pythonExePath ?? this.pythonExecutable}" -m pip list --format=json`;
			let packagesInfo = await this.executeBufferedCommand(cmd);
			let packagesResult: PythonPkgDetails[] = [];
			if (packagesInfo) {
				packagesResult = <PythonPkgDetails[]>JSON.parse(packagesInfo);
			}
			return packagesResult;
		}
		catch (err) {
			this.outputChannel.appendLine(msgPackageRetrievalFailed(utils.getErrorMessage(err)));
			return [];
		}
	}

	public installPipPackages(packages: PythonPkgDetails[], useMinVersion: boolean): Promise<void> {
		if (!packages || packages.length === 0) {
			return Promise.resolve();
		}

		let versionSpecifier = useMinVersion ? '>=' : '==';
		let packagesStr = packages.map(pkg => `"${pkg.name}${versionSpecifier}${pkg.version}"`).join(' ');
		let cmd = `"${this.pythonExecutable}" -m pip install --user ${packagesStr} --extra-index-url https://prose-python-packages.azurewebsites.net`;
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

			if (packagesInfo) {
				let packagesResult = JSON.parse(packagesInfo);
				if (Array.isArray(packagesResult)) {
					return packagesResult
						.filter(pkg => pkg && pkg.channel && pkg.channel !== 'pypi')
						.map(pkg => <PythonPkgDetails>{ name: pkg.name, version: pkg.version });
				}
			}
			return [];
		}
		catch (err) {
			this.outputChannel.appendLine(msgPackageRetrievalFailed(utils.getErrorMessage(err)));
			return [];
		}
	}

	public installCondaPackages(packages: PythonPkgDetails[], useMinVersion: boolean): Promise<void> {
		if (!packages || packages.length === 0) {
			return Promise.resolve();
		}

		let versionSpecifier = useMinVersion ? '>=' : '==';
		let packagesStr = packages.map(pkg => `"${pkg.name}${versionSpecifier}${pkg.version}"`).join(' ');
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

	private isCondaInstalled(): boolean {
		if (!this._usingExistingPython) {
			return false;
		}

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

		let useExistingInstall = JupyterServerInstallation.getExistingPythonSetting();
		let pythonExe = JupyterServerInstallation.getPythonExePath(pathSetting, useExistingInstall);
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

	public static getPythonExePath(pythonInstallPath: string, useExistingInstall: boolean): string {
		return path.join(
			pythonInstallPath,
			useExistingInstall ? '' : constants.pythonBundleVersion,
			process.platform === constants.winPlatform ? 'python.exe' : 'bin/python3');
	}

	private async getPythonUserDir(pythonExecutable: string): Promise<string> {
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

		return undefined;
	}

	public getRequiredPackagesForKernel(kernelName: string): PythonPkgDetails[] {
		return this._requiredKernelPackages.get(kernelName) ?? [];
	}

	public get previewFeaturesEnabled(): boolean {
		return vscode.workspace.getConfiguration('workbench').get('enablePreviewFeatures');
	}
}

export interface PythonPkgDetails {
	name: string;
	version: string;
}

export interface PipPackageOverview {
	name: string;
	versions: string[];
	summary: string;
}
