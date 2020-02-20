/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import * as constants from '../common/constants';
import * as nbExtensionApis from '../typings/notebookServices';
import * as utils from '../common/utils';

export enum ScriptMode {
	Install = 'install',
	Uninstall = 'uninstall'
}

export abstract class SqlPackageManageProviderBase {

	/**
	 * Base class for all SQL package managers
	 */
	constructor(protected _apiWrapper: ApiWrapper) {
	}

	/**
	 * Returns location title
	 */
	public async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : ''}`;
		}
		return constants.packageManagerNoConnection;
	}

	protected async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	/**
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	public async installPackages(packages: nbExtensionApis.IPackageDetails[], useMinVersion: boolean): Promise<void> {

		if (packages) {
			await Promise.all(packages.map(x => this.installPackage(x, useMinVersion)));
		}
		//TODO: use useMinVersion
		console.log(useMinVersion);
	}

	private async installPackage(packageDetail: nbExtensionApis.IPackageDetails, useMinVersion: boolean): Promise<void> {
		if (useMinVersion) {
			let packageOverview = await this.getPackageOverview(packageDetail.name);
			if (packageOverview && packageOverview.versions) {
				let minVersion = packageOverview.versions[packageOverview.versions.length - 1];
				packageDetail.version = minVersion;
			}
		}

		await this.executeScripts(ScriptMode.Install, packageDetail);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	public async uninstallPackages(packages: nbExtensionApis.IPackageDetails[]): Promise<void> {
		if (packages) {
			await Promise.all(packages.map(x => this.executeScripts(ScriptMode.Uninstall, x)));
		}
	}

	/**
	 * Returns package overview for given name
	 * @param packageName Package Name
	 */
	public async getPackageOverview(packageName: string): Promise<nbExtensionApis.IPackageOverview> {
		let packageOverview = await this.fetchPackage(packageName);
		if (packageOverview && packageOverview.versions) {
			packageOverview.versions = utils.sortPackageVersions(packageOverview.versions, false);
		}
		return packageOverview;
	}

	/**
	 * Returns list of packages
	 */
	public async listPackages(): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages = await this.fetchPackages();
		if (packages) {
			packages = packages.sort((a, b) => this.comparePackages(a, b));
		} else {
			packages = [];
		}
		return packages;
	}

	private comparePackages(p1: nbExtensionApis.IPackageDetails, p2: nbExtensionApis.IPackageDetails): number {
		if (p1 && p2) {
			let compare = p1.name.localeCompare(p2.name);
			if (compare === 0) {
				compare = utils.comparePackageVersions(p1.version, p2.version);
			}
			return compare;
		}
		return p1 ? 1 : -1;
	}

	protected abstract fetchPackage(packageName: string): Promise<nbExtensionApis.IPackageOverview>;
	protected abstract fetchPackages(): Promise<nbExtensionApis.IPackageDetails[]>;
	protected abstract executeScripts(scriptMode: ScriptMode, packageDetails: nbExtensionApis.IPackageDetails): Promise<void>;
}
