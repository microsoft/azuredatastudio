/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The API provided by this extension.
 *
 * @export
 */
export interface IExtensionApi {
	getJupyterController(): IJupyterController;
	registerPackageManager(providerId: string, packageManagerProvider: IPackageManageProvider): void
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
	listPackages(): Promise<IPackageDetails[]>;
	installPackages(package: IPackageDetails[], useMinVersion: boolean): Promise<void>;
	uninstallPackages(package: IPackageDetails[]): Promise<void>;
	canUseProvider(): Promise<boolean>;
	getLocationTitle(): string;
	getPackageOverview(packageName: string): Promise<IPackageOverview>;
}
