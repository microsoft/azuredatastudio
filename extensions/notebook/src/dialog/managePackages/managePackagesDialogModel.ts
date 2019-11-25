/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { IPackageManageProvider, IPackageDetails } from '../../types';

export interface ManagePackageDialogOptions {
	multiLocations: boolean;
	defaultLocation?: string;
}

/**
 * Manage package dialog model
 */
export class ManagePackageDialogModel {

	public currentProvider: string;
	private _locations: Set<string> = new Set<string>();
	private _packageTypes: Map<string, IPackageManageProvider[]> = new Map<string, IPackageManageProvider[]>();

	/**
	 * Creates new instance of the model
	 * @param _jupyterInstallation Jupyter installation
	 * @param _packageManageProviders package manage providers
	 * @param _options dialog options
	 */
	constructor(
		private _jupyterInstallation: JupyterServerInstallation,
		private _packageManageProviders: Map<string, IPackageManageProvider>,
		private _options?: ManagePackageDialogOptions) {

		if (!this._packageManageProviders || this._packageManageProviders.size === 0) {
			throw Error('Invalid list of package manager providers');
		}
	}

	/**
	 * Initialized the model
	 */
	public async init(): Promise<void> {
		await this.loadCaches();
		this.loadOptions();
	}

	/**
	 * Loads the model options
	 */
	private loadOptions(): void {
		// Set Default Options
		//
		if (!this._options) {
			this._options = {
				multiLocations: true,
				defaultLocation: undefined
			};
		}

		if (this._options.defaultLocation && !this._packageTypes.get(this._options.defaultLocation)) {
			throw new Error(`Invalid default location '${this._options.defaultLocation}`);
		}

		if (!this._options.multiLocations && !this.defaultLocation) {
			throw new Error('Default location not specified for single location mode');
		}
	}

	/**
	 * Returns the providers map
	 */
	public get packageManageProviders(): Map<string, IPackageManageProvider> {
		return this._packageManageProviders;
	}

	/**
	 * Returns the current provider
	 */
	public get currentPackageManageProvider(): IPackageManageProvider {
		if (this.currentProvider) {
			let provider = this._packageManageProviders.get(this.currentProvider);
			return provider;
		}
		return undefined;
	}

	/**
	 * Returns true if multi locations mode is enabled
	 */
	public get multiLocationMode(): boolean {
		return this._options.multiLocations;
	}

	/**
	 * returns the array of target locations
	 */
	public targetLocations(): string[] {
		return Array.from(this._locations.keys());
	}

	/**
	 * Returns the default location
	 */
	public get defaultLocation(): string {
		return this._options.defaultLocation || this.targetLocations()[0];
	}

	/**
	 * Loads the provider cache
	 */
	private async loadCaches(): Promise<void> {
		if (this.packageManageProviders) {
			let keyArray = Array.from(this.packageManageProviders.keys());
			for (let index = 0; index < keyArray.length; index++) {
				const element = this.packageManageProviders.get(keyArray[index]);
				if (await element.canUseProvider()) {
					if (!this._locations.has(element.packageTarget.location)) {
						this._locations.add(element.packageTarget.location);
					}
					if (!this._packageTypes.has(element.packageTarget.location)) {
						this._packageTypes.set(element.packageTarget.location, []);
					}
					this._packageTypes.get(element.packageTarget.location).push(element);
				}
			}
		}
	}

	/**
	 * Returns the package types for given location
	 */
	public getPackageTypes(targetLocation?: string): [string, string][] {
		targetLocation = targetLocation || this.defaultLocation;
		let providers = this._packageTypes.get(targetLocation);
		return providers.map(x => [x.providerId, x.packageTarget.packageType]);
	}

	/**
	 * returns the list of packages for current provider
	 */
	public async listPackage(): Promise<IPackageDetails[]> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.listPackages();
		} else {
			return Promise.reject('Current Provider is not set');
		}
	}

	/**
	 * Changes the current provider
	 */
	public changeProvider(providerId: string): void {
		if (this._packageManageProviders.has(providerId)) {
			this.currentProvider = providerId;
		} else {
			throw Error(`Invalid package type ${providerId}`);
		}
	}

	/**
	 * Installs give packages using current provider
	 * @param packages Packages to install
	 */
	public async installPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.installPackage(packages, false);
		} else {
			return Promise.reject('Current Provider is not set');
		}
	}

	/**
	 * Returns the location title for current provider
	 */
	public getLocationTitle(): string {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return provider.getLocationTitle();
		}
		return undefined;
	}

	/**
	 * UnInstalls give packages using current provider
	 * @param packages Packages to install
	 */
	public async uninstallPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.uninstallPackage(packages);
		} else {
			return Promise.reject('Current Provider is not set');
		}
	}

	/**
	 * Returns the jupyterInstallation instance
	 */
	public get jupyterInstallation(): JupyterServerInstallation {
		return this._jupyterInstallation;
	}
}
