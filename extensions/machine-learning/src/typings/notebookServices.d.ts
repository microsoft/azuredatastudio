/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

/**
 * The API provided by this extension.
 *
 * @export
 */
export interface IExtensionApi {
	getJupyterController(): IJupyterController;
	registerPackageManager(providerId: string, packageManagerProvider: IPackageManageProvider): void
	getPackageManagers(): Map<string, IPackageManageProvider>
}

export interface IJupyterController {
	jupyterInstallation: IJupyterServerInstallation;
}

export interface IJupyterServerInstallation {
	installPipPackages(packages: IPackageDetails[], useMinVersion: boolean): Promise<void>;
	uninstallPipPackages(packages: IPackageDetails[]): Promise<void>;
	installCondaPackages(packages: IPackageDetails[], useMinVersion: boolean): Promise<void>;
	uninstallCondaPackages(packages: IPackageDetails[]): Promise<void>;
	getInstalledPipPackages(): Promise<IPackageDetails[]>;
	pythonExecutable: string;
	pythonInstallationPath: string;
	executeBufferedCommand(command: string): Promise<string>;
	executeStreamedCommand(command: string): Promise<void>;
	installPythonPackage(backgroundOperation: azdata.BackgroundOperation, usingExistingPython: boolean, pythonInstallationPath: string, outputChannel: vscode.OutputChannel): Promise<void>;
}


export interface IPackageDetails {
	name: string;
	version: string;
	readonly?: boolean;
}

export interface IPackageTarget {
	location: string;
	packageType: string;
}

export interface IPackageOverview {
	name: string;
	versions: string[];
	summary: string;
}

export interface IPackageLocation {
	name: string;
	displayName: string;
}

/**
 * Package manage provider interface
 */
export interface IPackageManageProvider {
	/**
	 * Provider id
	 */
	providerId: string;

	/**
	 * package target
	 */
	packageTarget: IPackageTarget;

	/**
	 * Returns list of installed packages
	 */
	listPackages(location?: string): Promise<IPackageDetails[]>;

	/**
	 * Installs give packages
	 * @param package Packages to install
	 * @param useMinVersion if true, minimal version will be used
	 */
	installPackages(package: IPackageDetails[], useMinVersion: boolean, location?: string): Promise<void>;

	/**
	 * Uninstalls given packages
	 * @param package package to uninstall
	 */
	uninstallPackages(package: IPackageDetails[], location?: string): Promise<void>;

	/**
	 * Returns true if the provider can be used in current context
	 */
	canUseProvider(): Promise<boolean>;

	/**
	 * Returns location title
	 */
	getLocations(): Promise<IPackageLocation[]>;

	/**
	 * Returns Package Overview
	 * @param packageName package name
	 */
	getPackageOverview(packageName: string): Promise<IPackageOverview>;
}
