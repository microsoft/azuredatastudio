/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { ExecOptions } from 'child_process';

import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { Deferred } from '../common/promise';
import { ConfigurePythonWizard } from '../dialog/configurePython/configurePythonWizard';
import { IKernelInfo } from '../contracts/content';
import { requiredJupyterPackages } from './requiredJupyterPackages';

const localize = nls.loadMessageBundle();
const msgInstallPkgProgress = localize('msgInstallPkgProgress', "Notebook dependencies installation is in progress");
const msgTaskName = localize('msgTaskName', "Installing Notebook dependencies");
const msgInstallPkgStart = localize('msgInstallPkgStart', "Installing Notebook dependencies, see Tasks view for more information");
const msgInstallPkgFinish = localize('msgInstallPkgFinish', "Notebook dependencies installation is complete");
const msgWaitingForInstall = localize('msgWaitingForInstall', "Another Python installation is currently in progress. Waiting for it to complete.");
function msgDependenciesInstallationFailed(errorMessage: string): string { return localize('msgDependenciesInstallationFailed', "Installing Notebook dependencies failed with error: {0}", errorMessage); }
function msgPackageRetrievalFailed(errorMessage: string): string { return localize('msgPackageRetrievalFailed', "Encountered an error when trying to retrieve list of installed packages: {0}", errorMessage); }
function msgGetPythonUserDirFailed(errorMessage: string): string { return localize('msgGetPythonUserDirFailed', "Encountered an error when getting Python user path: {0}", errorMessage); }

export interface PythonInstallSettings {
	installPath: string;
	packages: PythonPkgDetails[];
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
	condaExecutable: string | undefined;
	pythonInstallationPath: string;
	installedPythonVersion: string;
}

export class JupyterServerInstallation implements IJupyterServerInstallation {
	public extensionPath: string;
	public pythonBinPath: string;
	public outputChannel: vscode.OutputChannel;
	public pythonEnvVarPath: string;
	public execOptions: ExecOptions;

	private _pythonInstallationPath: string;
	private _pythonExecutable: string;
	private _condaExecutable: string | undefined;
	private _installedPythonVersion: string;

	private _installInProgress = false;
	private _installCompletion: Deferred<void>;

	private static readonly DefaultPythonLocation = path.join(utils.getUserHome(), 'azuredatastudio-python');

	private readonly _kernelSetupCache = new Map<string, boolean>();
	private readonly _requiredKernelPackages = new Map<string, PythonPkgDetails[]>();
	private readonly _requiredPackageNames: Set<string>;

	private readonly _runningOnSAW: boolean;
	private readonly _tsgopsweb: boolean;

	constructor(extensionPath: string, outputChannel: vscode.OutputChannel) {
		this.extensionPath = extensionPath;
		this.outputChannel = outputChannel;

		this._runningOnSAW = vscode.env.appName.toLowerCase().indexOf('saw') > 0;
		this._tsgopsweb = vscode.env.appName.toLowerCase().indexOf('tsgops') > 0;
		void vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, 'notebook:runningOnSAW', this._runningOnSAW);

		if (this._runningOnSAW) {
			this._pythonInstallationPath = `${vscode.env.appRoot}\\ads-python`;
		} else if (this._tsgopsweb) {
			this._pythonInstallationPath = `/usr`;
		} else {
			this._pythonInstallationPath = JupyterServerInstallation.getPythonInstallPath();
		}

		let allPackages = requiredJupyterPackages.sharedPackages;
		for (let kernelInfo of requiredJupyterPackages.kernels) {
			// Add this kernel's specific dependencies to the running list of packages for All Kernels.
			allPackages = allPackages.concat(kernelInfo.packages);

			// Combine this kernel's specific dependencies with the shared list of packages to get its
			// full list of dependencies
			let packages = requiredJupyterPackages.sharedPackages.concat(kernelInfo.packages);
			this._requiredKernelPackages.set(kernelInfo.name, packages);
		}

		this._requiredKernelPackages.set(constants.allKernelsName, allPackages);

		this._requiredPackageNames = new Set<string>(allPackages.map(pkg => pkg.name));
	}

	private async installDependencies(backgroundOperation: azdata.BackgroundOperation, forceInstall: boolean, packages: PythonPkgDetails[]): Promise<void> {
		void vscode.window.showInformationMessage(msgInstallPkgStart);

		this.outputChannel.show(true);
		this.outputChannel.appendLine(msgInstallPkgProgress);
		backgroundOperation.updateStatus(azdata.TaskStatus.InProgress, msgInstallPkgProgress);

		try {
			await this.upgradePythonPackages(forceInstall, packages);
		} catch (err) {
			this.outputChannel.appendLine(msgDependenciesInstallationFailed(utils.getErrorMessage(err)));
			throw err;
		}

		this.outputChannel.appendLine(msgInstallPkgFinish);
		backgroundOperation.updateStatus(azdata.TaskStatus.Succeeded, msgInstallPkgFinish);
		void vscode.window.showInformationMessage(msgInstallPkgFinish);
	}

	public async configurePackagePaths(): Promise<void> {
		// Delete existing Python variables in ADS to prevent conflict with other installs
		delete process.env['PYTHONPATH'];
		delete process.env['PYTHONSTARTUP'];
		delete process.env['PYTHONHOME'];

		// Update python paths and properties to reference user's local python.
		let pythonBinPathSuffix = process.platform === constants.winPlatform ? '' : 'bin';

		this._pythonExecutable = JupyterServerInstallation.getPythonExePath(this._pythonInstallationPath);
		this._condaExecutable = await JupyterServerInstallation.getCondaExePath(this._pythonInstallationPath);
		this.pythonBinPath = path.join(this._pythonInstallationPath, pythonBinPathSuffix);

		// Store paths to python libraries required to run jupyter.
		this.pythonEnvVarPath = process.env['PATH'];

		let delimiter = path.delimiter;
		this.pythonEnvVarPath = this.pythonBinPath + delimiter + this.pythonEnvVarPath;
		if (process.platform === constants.winPlatform) {
			let pythonScriptsPath = path.join(this._pythonInstallationPath, 'Scripts');
			this.pythonEnvVarPath = pythonScriptsPath + delimiter + this.pythonEnvVarPath;

			if (this.usingConda) {
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
				packages: this.getRequiredPackagesForKernel(constants.python3DisplayName)
			};
		}

		if (this._installInProgress) {
			void vscode.window.showInformationMessage(msgWaitingForInstall);
			return this._installCompletion.promise;
		}

		this._installInProgress = true;
		this._installCompletion = new Deferred<void>();
		try {
			this._pythonInstallationPath = installSettings.installPath;
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
							await this.configurePackagePaths();

							await vscode.commands.executeCommand(constants.BuiltInCommands.SetContext, constants.CommandContext.NotebookPythonInstalled, true);
							this._installCompletion.resolve();
							this._installInProgress = false;
						})
						.catch(err => {
							let errorMsg = msgDependenciesInstallationFailed(utils.getErrorMessage(err));
							op.updateStatus(azdata.TaskStatus.Failed, errorMsg);
							this._installCompletion.reject(new Error(errorMsg));
							this._installInProgress = false;
						});
				}
			});
		} catch (err) {
			let errorMsg = msgDependenciesInstallationFailed(utils.getErrorMessage(err));
			this._installCompletion.reject(new Error(errorMsg));
			this._installInProgress = false;
		}
		return this._installCompletion.promise;
	}

	/**
	 * Opens a dialog for configuring the installation path for the Notebook Python dependencies.
	 */
	public async promptForPythonInstall(kernelDisplayName: string): Promise<void> {
		if (this._runningOnSAW || this._tsgopsweb) {
			return Promise.resolve();
		}
		if (this._installInProgress) {
			void vscode.window.showInformationMessage(msgWaitingForInstall);
			return this._installCompletion.promise;
		}

		let isPythonInstalled = JupyterServerInstallation.isPythonInstalled();
		let areRequiredPackagesInstalled = await this.areRequiredPackagesInstalled(kernelDisplayName);
		if (!isPythonInstalled || !areRequiredPackagesInstalled) {
			let pythonWizard = new ConfigurePythonWizard(this);
			await pythonWizard.start(kernelDisplayName, true);
			return pythonWizard.setupComplete.then(() => {
				this._kernelSetupCache.set(kernelDisplayName, true);
			});
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
			if (!installedVersion || utils.compareVersions(installedVersion, pkg.version) < 0 || (pkg.installExactVersion && installedVersion !== pkg.version)) {
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
				if (!installedPkgVersion || utils.compareVersions(installedPkgVersion, pkg.version) < 0 || (pkg.installExactVersion && installedPkgVersion !== pkg.version)) {
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
			if (this._requiredPackageNames.has(pkg.name)) {
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
			if (!this.condaExecutable) {
				return [];
			}
			let cmd = `"${this.condaExecutable}" list --json`;
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

	public async installCondaPackages(packages: PythonPkgDetails[], useMinVersionDefault: boolean): Promise<void> {
		if (!this.condaExecutable || !packages || packages.length === 0) {
			return Promise.resolve();
		}

		let versionSpecifierDefault = useMinVersionDefault ? '>=' : '==';
		let packagesStr = packages.map(pkg => {
			const pkgVersionSpecifier = pkg.installExactVersion ? '==' : versionSpecifierDefault;
			return `"${pkg.name}${pkgVersionSpecifier}${pkg.version}"`;
		}).join(' ');

		let cmd = `"${this.condaExecutable}" install -c conda-forge -y ${packagesStr}`;
		await this.executeStreamedCommand(cmd);
	}

	public async uninstallCondaPackages(packages: PythonPkgDetails[]): Promise<void> {
		if (this.condaExecutable) {
			for (let pkg of packages) {
				if (this._requiredPackageNames.has(pkg.name)) {
					this._kernelSetupCache.clear();
					break;
				}
			}

			let packagesStr = packages.map(pkg => `"${pkg.name}==${pkg.version}"`).join(' ');
			let cmd = `"${this.condaExecutable}" uninstall -y ${packagesStr}`;
			await this.executeStreamedCommand(cmd);
		}
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

	public get condaExecutable(): string | undefined {
		return this._condaExecutable;
	}

	public static async getCondaExePath(pythonInstallationPath: string): Promise<string> {
		let exeName = process.platform === constants.winPlatform ? 'Scripts\\conda.exe' : 'bin/conda';
		let condaPath = path.join(pythonInstallationPath, exeName);
		let condaExists = await fs.pathExists(condaPath);
		// If conda was not found, then check if we're using a virtual environment
		if (!condaExists) {
			let pathParts = pythonInstallationPath.split(path.sep);
			if (pathParts.length > 1 && pathParts[pathParts.length - 2] === 'envs') {
				// The root Anaconda folder is 2 folders above the virtual environment's folder
				// Example: Anaconda3\envs\myEnv\python.exe -> Anaconda3\conda.exe
				// Docs: https://conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html#creating-an-environment-with-commands
				condaPath = path.join(pythonInstallationPath, '..', '..', exeName);
				condaExists = await fs.pathExists(condaPath);
			}
			if (!condaExists) {
				condaPath = undefined;
			}
		}
		return condaPath;
	}

	/**
	 * Returns Python installation path
	 */
	public get pythonInstallationPath(): string {
		return this._pythonInstallationPath;
	}

	public get usingConda(): boolean {
		return !!this._condaExecutable;
	}

	public get installedPythonVersion(): string {
		return this._installedPythonVersion;
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
