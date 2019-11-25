/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackageManageProvider, IPackageDetails, IPackageTarget } from '../types';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as constants from '../common/constants';

export class LocalPipPackageManageProvider implements IPackageManageProvider {

	/**
	 * Provider Id for Pip package manage provider
	 */
	public static ProviderId = 'localhost_Python';

	constructor(private jupyterInstallation: JupyterServerInstallation) {
	}

	/**
	 * Returns provider Id
	 */
	public get providerId(): string {
		return LocalPipPackageManageProvider.ProviderId;
	}

	/**
	 * Returns package target
	 */
	public get packageTarget(): IPackageTarget {
		return { location: constants.localhostName, packageType: constants.PythonPkgType.Pip };
	}

	/**
	 * Returns list of packages
	 */
	public async listPackages(): Promise<IPackageDetails[]> {
		return await this.jupyterInstallation.getInstalledPipPackages();
	}

	/**
	 * Installs give packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	installPackage(packages: IPackageDetails[], useMinVersion: boolean): Promise<void> {
		return this.jupyterInstallation.installPipPackages(packages, useMinVersion);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	uninstallPackage(packages: IPackageDetails[]): Promise<void> {
		return this.jupyterInstallation.uninstallPipPackages(packages);
	}

	/**
	 * Returns true if the provider can be used
	 */
	canUseProvider(): Promise<boolean> {
		return Promise.resolve(true);
	}

	/**
	 * Returns location title
	 */
	getLocationTitle(): string {
		return constants.localhostTitle;
	}
}
