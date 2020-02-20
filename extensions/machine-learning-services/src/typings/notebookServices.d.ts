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

export interface IPackageManageProvider {
	providerId: string;
	packageTarget: IPackageTarget;
	listPackages(): Promise<IPackageDetails[]>
	installPackages(package: IPackageDetails[], useMinVersion: boolean): Promise<void>;
	uninstallPackages(package: IPackageDetails[]): Promise<void>;
	canUseProvider(): Promise<boolean>;
	getLocationTitle(): Promise<string>;
	getPackageOverview(packageName: string): Promise<IPackageOverview>
}
