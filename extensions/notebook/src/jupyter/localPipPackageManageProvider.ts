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
		private pyPiClient: IPyPiClient) {
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
		let body = await this.pyPiClient.fetchPypiPackage(packageName);
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

	// Determines if a given package is supported for the provided version of Python
	// using the version constraints from the pypi metadata.
	public static isPackageSupported(pythonVersion: string, packageVersionConstraints: string[]): boolean {
		if (pythonVersion === '') {
			return true;
		}

		// Version constraint strings are formatted like '!=2.7, >=3.5, >=3.6',
		// with each package release having its own set of version constraints.
		let supportedVersionFound = true;
		for (let packageVersionConstraint of packageVersionConstraints) {
			if (!packageVersionConstraint) {
				continue;
			}

			let constraintParts = packageVersionConstraint.split(',');
			for (let constraint of constraintParts) {
				constraint = constraint.trim();
				let splitIndex: number;
				if ((constraint[0] === '>' || constraint[0] === '<') && constraint[1] !== '=') {
					splitIndex = 1;
				} else {
					splitIndex = 2;
				}
				let versionSpecifier = constraint.slice(0, splitIndex);
				let version = constraint.slice(splitIndex).trim();
				let versionComparison = utils.comparePackageVersions(pythonVersion, version);
				if ((versionSpecifier === '>=' && versionComparison === -1) ||
					(versionSpecifier === '<=' && versionComparison === 1) ||
					(versionSpecifier === '>' && versionComparison !== 1) ||
					(versionSpecifier === '<' && versionComparison !== -1) ||
					(versionSpecifier === '==' && versionComparison !== 0) ||
					(versionSpecifier === '!=' && versionComparison === 0)) {
					supportedVersionFound = false;
					break; // Failed at least one version check, so skip checking the other constraints
				} else {
					supportedVersionFound = true; // The package is tentatively supported until we find a constraint that fails
				}
			}
			if (supportedVersionFound) {
				break; // All constraints passed for this package, so we don't need to check any of the others
			}
		}
		return supportedVersionFound;
	}
}
