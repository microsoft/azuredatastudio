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
	 * Returns current location
	 */
	public async getCurrentLocation(): Promise<string | undefined> {
		return Promise.resolve(constants.localhostName);
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
			let currentRelease: string;
			if (packagesJson.info) {
				if (packagesJson.info.summary) {
					packageSummary = packagesJson.info.summary;
				}
				currentRelease = packagesJson.info.version?.toString();
			}

			if (packagesJson.releases) {
				let versionKeys = Object.keys(packagesJson.releases);
				versionKeys = versionKeys.filter(versionKey => {
					let releaseInfo = packagesJson.releases[versionKey];
					if (Array.isArray(releaseInfo) && releaseInfo.length > 0) {
						let pythonVersionConstraints = releaseInfo.map<string>(info => info.requires_python);
						return LocalPipPackageManageProvider.isPackageSupported(this.jupyterInstallation.installedPythonVersion, pythonVersionConstraints);
					}
					return false;
				});
				versionNums = utils.sortPackageVersions(versionKeys, false);

				// Place current stable release at the front of the list
				if (currentRelease) {
					let releaseIndex = versionNums.findIndex(value => value === currentRelease);
					if (releaseIndex > 0) {
						versionNums.splice(releaseIndex, 1);
						versionNums.unshift(currentRelease);
					}
				}
			}
		}

		return {
			name: packageName,
			versions: versionNums,
			summary: packageSummary
		};
	}

	// Determines if a given package is supported for the installed version of Python
	// using the version constraints from the pypi metadata.
	public static isPackageSupported(pythonVersion: string, versionConstraints: string[]): boolean {
		if (pythonVersion === '') {
			return true;
		}

		let supportedVersionFound = true;
		for (let versionConstraint of versionConstraints) {
			if (!versionConstraint) {
				continue;
			}

			let constraintParts = versionConstraint.split(',');
			for (let constraintPart of constraintParts) {
				let versionModifier = constraintPart.slice(0, 2);
				let version = constraintPart.slice(2);
				let versionComparison = utils.comparePackageVersions(pythonVersion, version);
				if ((versionModifier === '>=' && versionComparison === -1) ||
					(versionModifier === '!=' && versionComparison === 0)) {
					supportedVersionFound = false;
				} else {
					supportedVersionFound = true;
					break;
				}
			}
			if (supportedVersionFound) {
				break;
			}
		}
		return supportedVersionFound;
	}
}
