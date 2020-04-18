/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPackageManageProvider, IPackageDetails, IPackageTarget, IPackageOverview, IPackageLocation } from '../types';
import { IJupyterServerInstallation } from './jupyterServerInstallation';
import * as constants from '../common/constants';
import * as utils from '../common/utils';

export class LocalCondaPackageManageProvider implements IPackageManageProvider {

	/**
	 * Provider Id for Anaconda package manage provider
	 */
	public static ProviderId = 'localhost_Anaconda';

	constructor(private jupyterInstallation: IJupyterServerInstallation) {
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
	public async listPackages(location?: string): Promise<IPackageDetails[]> {
		return await this.jupyterInstallation.getInstalledCondaPackages();
	}

	/**
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	installPackages(packages: IPackageDetails[], useMinVersion: boolean, location?: string): Promise<void> {
		return this.jupyterInstallation.installCondaPackages(packages, useMinVersion);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	uninstallPackages(packages: IPackageDetails[], location?: string): Promise<void> {
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
	getLocations(): Promise<IPackageLocation[]> {
		return Promise.resolve([{ displayName: constants.localhostTitle, name: constants.localhostName }]);
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	getPackageOverview(packageName: string): Promise<IPackageOverview> {
		return this.fetchCondaPackage(packageName);
	}

	private async fetchCondaPackage(packageName: string): Promise<IPackageOverview> {
		let condaExe = this.jupyterInstallation.getCondaExePath();
		let cmd = `"${condaExe}" search --json ${packageName}`;
		let packageResult: string;
		try {
			packageResult = await this.jupyterInstallation.executeBufferedCommand(cmd);
		} catch (err) {
			throw new Error(constants.PackageNotFoundError);
		}

		if (packageResult) {
			let packageJson = JSON.parse(packageResult);
			if (packageJson) {
				if (packageJson.error) {
					throw new Error(packageJson.error);
				}

				let packages = packageJson[packageName];
				if (Array.isArray(packages)) {
					let allVersions = packages.filter(pkg => pkg && pkg.version).map(pkg => pkg.version);
					let singletonVersions = new Set<string>(allVersions);
					let sortedVersions = utils.sortPackageVersions(Array.from(singletonVersions), false);
					return {
						name: packageName,
						versions: sortedVersions,
						summary: undefined
					};
				}
			}
		}

		return undefined;
	}
}
