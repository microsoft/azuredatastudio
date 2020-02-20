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
	registerPackageManager(providerId: string, packageManagerProvider: IPackageManageProvider): void;
	getPackageManagers(): Map<string, IPackageManageProvider>;
}

/**
 * jupyter controller interface
 */
export interface IJupyterController {
	/**
	 * Server installation instance
	 */
	jupyterInstallation: IJupyterServerInstallation;
}

export interface IJupyterServerInstallation {
	/**
	 * Installs packages using pip
	 * @param packages packages to install
	 * @param useMinVersion if true, minimal version will be used
	 */
	installPipPackages(packages: IPackageDetails[], useMinVersion: boolean): Promise<void>;

	/**
	 * Uninstalls packages using pip
	 * @param packages packages to uninstall
	 */
	uninstallPipPackages(packages: IPackageDetails[]): Promise<void>;

	/**
	 * Installs conda packages
	 * @param packages packages to install
	 * @param useMinVersion if true, minimal version will be used
	 */
	installCondaPackages(packages: IPackageDetails[], useMinVersion: boolean): Promise<void>;

	/**
	 * Uninstalls packages using conda
	 * @param packages packages to uninstall
	 */
	uninstallCondaPackages(packages: IPackageDetails[]): Promise<void>;

	/**
	 * Returns installed pip packages
	 */
	getInstalledPipPackages(): Promise<IPackageDetails[]>;
}

/**
 * Package details interface
 */
export interface IPackageDetails {
	name: string;
	version: string;
}

/**
 * Package target interface
 */
export interface IPackageTarget {
	location: string;
	packageType: string;
}

/**
 * Package overview
 */
export interface IPackageOverview {
	name: string;
	versions: string[];
	summary: string;
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
	listPackages(): Promise<IPackageDetails[]>;

	/**
	 * Installs give packages
	 * @param package Packages to install
	 * @param useMinVersion if true, minimal version will be used
	 */
	installPackages(package: IPackageDetails[], useMinVersion: boolean): Promise<void>;

	/**
	 * Uninstalls given packages
	 * @param package package to uninstall
	 */
	uninstallPackages(package: IPackageDetails[]): Promise<void>;

	/**
	 * Returns true if the provider can be used in current context
	 */
	canUseProvider(): Promise<boolean>;

	/**
	 * Returns location title
	 */
	getLocationTitle(): Promise<string>;

	/**
	 * Returns Package Overview
	 * @param packageName package name
	 */
	getPackageOverview(packageName: string): Promise<IPackageOverview>;
}
