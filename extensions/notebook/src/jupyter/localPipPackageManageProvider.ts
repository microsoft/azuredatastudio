/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackageManageProvider, IPackageDetails, IPackageTarget, IPackageOverview, IPackageLocation } from '../types';
import { IJupyterServerInstallation } from './jupyterServerInstallation';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import { IPyPiClient } from './pypiClient';

export class LocalPipPackageManageProvider implements IPackageManageProvider {

	/**
	 * Provider Id for Pip package manage provider
	 */
	public static ProviderId = 'localhost_Pip';

	constructor(
		private jupyterInstallation: IJupyterServerInstallation,
		private pipyClient: IPyPiClient) {
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
	public async listPackages(location?: string): Promise<IPackageDetails[]> {
		return await this.jupyterInstallation.getInstalledPipPackages();
	}

	/**
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	installPackages(packages: IPackageDetails[], useMinVersion: boolean, location?: string): Promise<void> {
		return this.jupyterInstallation.installPipPackages(packages, useMinVersion);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	uninstallPackages(packages: IPackageDetails[], location?: string): Promise<void> {
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
	getLocations(): Promise<IPackageLocation[]> {
		return Promise.resolve([{ displayName: constants.localhostTitle, name: constants.localhostName }]);
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	getPackageOverview(packageName: string): Promise<IPackageOverview> {
		return this.fetchPypiPackage(packageName);
	}

	private async fetchPypiPackage(packageName: string): Promise<IPackageOverview> {
		let body = await this.pipyClient.fetchPypiPackage(packageName);
		let packagesJson = JSON.parse(body);
		let versionNums: string[] = [];
		let packageSummary = '';
		if (packagesJson) {
			if (packagesJson.releases) {
				let versionKeys = Object.keys(packagesJson.releases);
				versionKeys = versionKeys.filter(versionKey => {
					let releaseInfo = packagesJson.releases[versionKey];
					return Array.isArray(releaseInfo) && releaseInfo.length > 0;
				});
				versionNums = utils.sortPackageVersions(versionKeys, false);
			}

			if (packagesJson.info && packagesJson.info.summary) {
				packageSummary = packagesJson.info.summary;
			}
		}

		return {
			name: packageName,
			versions: versionNums,
			summary: packageSummary
		};
	}
}
