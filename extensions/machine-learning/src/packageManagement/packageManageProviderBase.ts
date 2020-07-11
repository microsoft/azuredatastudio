/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
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
	 * Returns database names
	 */
	public async getLocations(): Promise<nbExtensionApis.IPackageLocation[]> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			let databases = await this._apiWrapper.listDatabases(connection.connectionId);
			return databases.map(x => {
				return { displayName: x, name: x };
			});
		}
		return [];
	}

	protected async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	/**
	 * Installs given packages
	 * @param packages Packages to install
	 * @param useMinVersion minimum version
	 */
	public async installPackages(packages: nbExtensionApis.IPackageDetails[], useMinVersion: boolean, databaseName: string): Promise<void> {

		if (packages) {
			await Promise.all(packages.map(x => this.installPackage(x, useMinVersion, databaseName)));
		}
		//TODO: use useMinVersion
		console.log(useMinVersion);
	}

	private async installPackage(packageDetail: nbExtensionApis.IPackageDetails, useMinVersion: boolean, databaseName: string): Promise<void> {
		if (useMinVersion) {
			let packageOverview = await this.getPackageOverview(packageDetail.name);
			if (packageOverview && packageOverview.versions) {
				let minVersion = packageOverview.versions[packageOverview.versions.length - 1];
				packageDetail.version = minVersion;
			}
		}

		await this.executeScripts(ScriptMode.Install, packageDetail, databaseName);
	}

	/**
	 * Uninstalls given packages
	 * @param packages Packages to uninstall
	 */
	public async uninstallPackages(packages: nbExtensionApis.IPackageDetails[], databaseName: string): Promise<void> {
		let allPackages = await this.listPackages(databaseName);

		if (packages) {
			await Promise.all(packages.map(x => {
				const originalPackage = allPackages.find(p => p.name === x.name && p.version === x.version);
				if (originalPackage && originalPackage.readonly) {
					return Promise.reject(`Cannot uninstalled system package '${x.name}'`);
				} else {
					return this.executeScripts(ScriptMode.Uninstall, x, databaseName);
				}
			}));
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
	public async listPackages(databaseName: string): Promise<nbExtensionApis.IPackageDetails[]> {
		let packages = await this.fetchPackages(databaseName);
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
	protected abstract fetchPackages(databaseName: string): Promise<nbExtensionApis.IPackageDetails[]>;
	protected abstract executeScripts(scriptMode: ScriptMode, packageDetails: nbExtensionApis.IPackageDetails, databaseName: string): Promise<void>;
}
