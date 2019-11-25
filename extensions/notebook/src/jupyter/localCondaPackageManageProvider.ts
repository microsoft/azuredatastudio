/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackageManageProvider, IPackageDetails, IPackageTarget } from '../types';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as constants from '../common/constants';

export class LocalCondaPackageManageProvider implements IPackageManageProvider {


	/**
	 * Provider Id for Anaconda package manage provider
	 */
	public static ProviderId = 'localhost_Anaconda';

	constructor(private jupyterInstallation: JupyterServerInstallation) {
	}

	/**
	 * Returns package target
	 */
	public get packageTarget(): IPackageTarget {
		return { location: constants.localhostName, packageType: constants.PythonPkgType.Anaconda };
	}

	/**
	 * Returns provider Id
	 */
	public get providerId(): string {
		return LocalCondaPackageManageProvider.ProviderId;
	}

	/**
	 * Returns list of packages
	 */
	public async listPackages(): Promise<IPackageDetails[]> {
		return await this.jupyterInstallation.getInstalledCondaPackages();
	}

	/**
	 * Installs give packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	installPackage(packages: IPackageDetails[], useMinVersion: boolean): Promise<void> {
		return this.jupyterInstallation.installCondaPackages(packages, useMinVersion);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	uninstallPackage(packages: IPackageDetails[]): Promise<void> {
		return this.jupyterInstallation.uninstallCondaPackages(packages);
	}

	/**
	 * Returns true if the provider can be used
	 */
	canUseProvider(): Promise<boolean> {
		return Promise.resolve(this.jupyterInstallation.usingConda);
	}

	/**
	 * Returns location title
	 */
	getLocationTitle(): string {
		return constants.localhostTitle;
	}
}
