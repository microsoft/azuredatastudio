/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { IPackageManageProvider, IPackageDetails, IPackageOverview, IPackageLocation } from '../../types';

export interface ManagePackageDialogOptions {
	defaultLocation?: string;
	defaultProviderId?: string;
}

export interface ProviderPackageType {
	packageType: string;
	providerId: string;
}

/**
 * Manage package dialog model
 */
export class ManagePackagesDialogModel {

	private _currentProvider: string;
	private _currentLocation: string;

	/**
	 * A set for locations
	 */
	private _locationTypes: Set<string> = new Set<string>();

	/**
	 * Map of locations to providers
	 */
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
		this.changeProvider(this.defaultProviderId);
	}

	/**
	 * Loads the model options
	 */
	private loadOptions(): void {

		// Set Default Options
		//
		if (!this._options) {
			this._options = this.defaultOptions;
		}

		if (this._options.defaultLocation && !this._packageTypes.has(this._options.defaultLocation)) {
			throw new Error(`Invalid default location '${this._options.defaultLocation}`);
		}

		if (this._options.defaultProviderId && !this._packageManageProviders.has(this._options.defaultProviderId)) {
			throw new Error(`Invalid default provider id '${this._options.defaultProviderId}`);
		}
	}

	private get defaultOptions(): ManagePackageDialogOptions {
		return {
			defaultLocation: undefined,
			defaultProviderId: undefined
		};
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
	public get currentPackageManageProvider(): IPackageManageProvider | undefined {
		if (this._currentProvider) {
			let provider = this._packageManageProviders.get(this._currentProvider);
			return provider;
		}
		return undefined;
	}

	/**
	 * Returns the current provider
	 */
	public get currentPackageType(): string | undefined {
		if (this._currentProvider) {
			let provider = this._packageManageProviders.get(this._currentProvider);
			return provider.packageTarget.packageType;
		}
		return undefined;
	}

	/**
	 * Returns options
	 */
	public get options(): ManagePackageDialogOptions {
		return this._options || this.defaultOptions;
	}

	/**
	 * returns the array of target location types
	 */
	public get targetLocationTypes(): string[] {
		return Array.from(this._locationTypes.keys());
	}

	/**
	 * Returns the default location
	 */
	public get defaultLocation(): string | undefined {
		return this.options.defaultLocation || (this.targetLocationTypes.length > 0 ? this.targetLocationTypes[0] : undefined);
	}

	/**
	 * Returns the default location
	 */
	public get defaultProviderId(): string {
		return this.options.defaultProviderId || Array.from(this.packageManageProviders.keys())[0];
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
					if (!this._locationTypes.has(element.packageTarget.location)) {
						this._locationTypes.add(element.packageTarget.location);
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
	 * Returns a map of providerId to package types for given location
	 */
	public getPackageTypes(targetLocation?: string): ProviderPackageType[] {
		targetLocation = targetLocation || this.defaultLocation;
		if (!this._packageTypes.has(targetLocation)) {
			return [];
		}
		const providers = this._packageTypes.get(targetLocation);
		return providers.map(x => {
			return {
				providerId: x.providerId,
				packageType: x.packageTarget.packageType
			};
		});
	}

	/**
	 * Returns a map of providerId to package types for given location
	 */
	public getDefaultPackageType(): ProviderPackageType | undefined {
		let defaultProviderId = this.defaultProviderId;
		let packageTypes = this.getPackageTypes();
		return packageTypes.find(x => x.providerId === defaultProviderId);
	}

	/**
	 * returns the list of packages for current provider
	 */
	public async listPackages(): Promise<IPackageDetails[]> {
		const provider = this.currentPackageManageProvider;
		return await provider?.listPackages(this._currentLocation) ?? [];
	}

	/**
	 * Changes the current provider
	 */
	public changeProvider(providerId: string): void {
		if (this._packageManageProviders.has(providerId)) {
			this._currentProvider = providerId;
		} else {
			throw Error(`Invalid package type ${providerId}`);
		}
	}

	/**
	 * Changes the current location
	 */
	public changeLocation(location: string): void {
		this._currentLocation = location;
	}

	/**
	 * Installs given packages using current provider
	 * @param packages Packages to install
	 */
	public async installPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.installPackages(packages, false, this._currentLocation);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns the location title for current provider
	 */
	public async getLocations(): Promise<IPackageLocation[] | undefined> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.getLocations();
		}
		return Promise.resolve(undefined);
	}

	/**
	 * UnInstalls given packages using current provider
	 * @param packages Packages to install
	 */
	public async uninstallPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.uninstallPackages(packages, this._currentLocation);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns package preview for given name
	 * @param packageName Package name
	 */
	public async getPackageOverview(packageName: string): Promise<IPackageOverview> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.getPackageOverview(packageName);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns the jupyterInstallation instance
	 */
	public get jupyterInstallation(): JupyterServerInstallation {
		return this._jupyterInstallation;
	}
}
