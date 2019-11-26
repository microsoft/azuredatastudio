/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import { IPackageManageProvider, IPackageDetails, IPackageTarget, IPackageOverview } from '../types';
import { JupyterServerInstallation } from './jupyterServerInstallation';
import * as constants from '../common/constants';
import * as utils from '../common/utils';
import * as request from 'request';

const localize = nls.loadMessageBundle();

export class LocalPipPackageManageProvider implements IPackageManageProvider {

	/**
	 * Provider Id for Pip package manage provider
	 */
	public static ProviderId = 'localhost_Pip';

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
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	installPackages(packages: IPackageDetails[], useMinVersion: boolean): Promise<void> {
		return this.jupyterInstallation.installPipPackages(packages, useMinVersion);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	uninstallPackages(packages: IPackageDetails[]): Promise<void> {
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
		return constants.localhostName;
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	getPackageOverview(packageName: string): Promise<IPackageOverview> {
		return this.fetchPypiPackage(packageName);
	}

	private async fetchPypiPackage(packageName: string): Promise<IPackageOverview> {
		return new Promise<IPackageOverview>((resolve, reject) => {
			request.get(`https://pypi.org/pypi/${packageName}/json`, { timeout: 10000 }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(constants.PackageNotFoundError);
				}

				if (response.statusCode !== 200) {
					return reject(
						localize('managePackages.packageRequestError',
							"Package info request failed with error: {0} {1}",
							response.statusCode,
							response.statusMessage));
				}

				let versionNums: string[] = [];
				let packageSummary = '';

				let packagesJson = JSON.parse(body);
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

				resolve({
					name: packageName,
					versions: versionNums,
					summary: packageSummary
				});
			});
		});
	}
}
