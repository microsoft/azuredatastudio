/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import * as Constants from 'sql/common/constants';
import { Deferred } from 'sql/base/common/promise';

import * as sqlops from 'sqlops';

import Event, { Emitter } from 'vs/base/common/event';
import { IAction } from 'vs/base/common/actions';
import { getGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { IExtensionManagementService, ILocalExtension, IExtensionEnablementService, LocalExtensionType } from 'vs/platform/extensionManagement/common/extensionManagement';
import { Memento } from 'vs/workbench/common/memento';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { IStorageService } from 'vs/platform/storage/common/storage';

export const SERVICE_ID = 'capabilitiesService';
export const HOST_NAME = 'sqlops';
export const HOST_VERSION = '1.0';

interface IProtocolMomento {
	[id: string]: sqlops.DataProtocolServerCapabilities;
}

export const clientCapabilities = {
	hostName: HOST_NAME,
	hostVersion: HOST_VERSION
};

export const ICapabilitiesService = createDecorator<ICapabilitiesService>(SERVICE_ID);

/**
 * Interface for managing provider capabilities
 */
export interface ICapabilitiesService {
	_serviceBrand: any;

	/**
	 * Retrieve a list of registered capabilities providers
	 */
	getCapabilities(provider: string): sqlops.DataProtocolServerCapabilities;

	/**
	 * Register a capabilities provider
	 */
	registerProvider(provider: sqlops.CapabilitiesProvider): void;

	/**
	 * Returns true if the feature is available for given connection
	 */
	isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean;

	/**
	 * Promise fulfilled when Capabilities are ready
	 */
	onCapabilitiesReady(): Promise<void>;

	/**
	 * When a new capabilities is registered, it emits the provider name, be to use to get the new capabilities
	 */
	readonly onCapabilitiesRegistered: Event<string>;

	/**
	 * Get an array of all known providers
	 */
	readonly providers: string[];

}

/**
 * Capabilities service implementation class.  This class provides the ability
 * to discover the DMP capabilties that a DMP provider offers.
 */
export class CapabilitiesService extends Disposable implements ICapabilitiesService {

	public _serviceBrand: any;

	private _momento = new Memento('capabilitiesCache');

	private static DATA_PROVIDER_CATEGORY: string = 'Data Provider';

	private disposables: IDisposable[] = [];

	private _onCapabilitiesReady = new Deferred<void>();

	// Setting this to 1 by default as we have MS SQL provider by default and then we increament
	// this number based on extensions installed.
	// TODO once we have a complete extension story this might change and will have to be looked into

	private _expectedCapabilitiesCount: number = 1;

	private _registeredCapabilities: number = 0;

	private _onCapabilitiesRegistered = this._register(new Emitter<string>());
	public readonly onCapabilitiesRegistered = this._onCapabilitiesRegistered.event;

	constructor(
		@IExtensionManagementService private extensionManagementService: IExtensionManagementService,
		@IExtensionEnablementService private extensionEnablementService: IExtensionEnablementService,
		@IStorageService private _storageService: IStorageService
	) {
		super();

		// Get extensions and filter where the category has 'Data Provider' in it
		this.extensionManagementService.getInstalled(LocalExtensionType.User).then((extensions: ILocalExtension[]) => {
			let dataProviderExtensions = extensions.filter(extension =>
				extension.manifest.categories && extension.manifest.categories.indexOf(CapabilitiesService.DATA_PROVIDER_CATEGORY) > -1);

			if (dataProviderExtensions.length > 0) {
				// Scrape out disabled extensions

				// @SQLTODO reenable this code
				// this.extensionEnablementService.getDisabledExtensions()
				// 	.then(disabledExtensions => {

				// 		let disabledExtensionsId = disabledExtensions.map(disabledExtension => disabledExtension.id);
				// 		dataProviderExtensions = dataProviderExtensions.filter(extension =>
				// 			disabledExtensions.indexOf(getGalleryExtensionId(extension.manifest.publisher, extension.manifest.name)) < 0);


				// 	// 	return extensions.map(extension => {
				// 	// 		return {
				// 	// 			identifier: { id: adoptToGalleryExtensionId(stripVersion(extension.identifier.id)), uuid: extension.identifier.uuid },
				// 	// 			local: extension,
				// 	// 			globallyEnabled: disabledExtensions.every(disabled => !areSameExtensions(disabled, extension.identifier))
				// 	// 		};
				// 	// 	});
				// 	});


				// const disabledExtensions = this.extensionEnablementService.getGloballyDisabledExtensions()
				// 															.map(disabledExtension => disabledExtension.id);
				// dataProviderExtensions = dataProviderExtensions.filter(extension =>
				// 	disabledExtensions.indexOf(getGalleryExtensionId(extension.manifest.publisher, extension.manifest.name)) < 0);
			}

			this._expectedCapabilitiesCount += dataProviderExtensions.length;
		});
	}

	public onCapabilitiesReady(): Promise<void> {
		return this._onCapabilitiesReady.promise;
	}

	/**
	 * Retrieve a list of registered server capabilities
	 */
	public getCapabilities(provider: string): sqlops.DataProtocolServerCapabilities {
		return this.capabilities[provider];
	}

	public get providers(): string[] {
		return Object.keys(this.capabilities);
	}

	private get capabilities(): IProtocolMomento {
		return this._momento.getMemento(this._storageService) as IProtocolMomento;
	}

	/**
	 * Register the capabilities provider and query the provider for its capabilities
	 * @param provider
	 */
	public registerProvider(provider: sqlops.CapabilitiesProvider): void {
		// request the capabilities from server
		provider.getServerCapabilities(clientCapabilities).then(serverCapabilities => {
			this.capabilities[serverCapabilities.providerName] = serverCapabilities;
			this._momento.saveMemento();
			this._onCapabilitiesRegistered.fire(serverCapabilities.providerName);
			this._registeredCapabilities++;
			this.resolveCapabilitiesIfReady();
		});
	}

	private resolveCapabilitiesIfReady(): void {
		if (this._registeredCapabilities === this._expectedCapabilitiesCount) {
			this._onCapabilitiesReady.resolve();
		}
	}

	/**
	 * Returns true if the feature is available for given connection
	 * @param featureComponent a component which should have the feature name
	 * @param connectionManagementInfo connectionManagementInfo
	 */
	public isFeatureAvailable(action: IAction, connectionManagementInfo: ConnectionManagementInfo): boolean {
		let isCloud = connectionManagementInfo && connectionManagementInfo.serverInfo && connectionManagementInfo.serverInfo.isCloud;
		let isMssql = connectionManagementInfo.connectionProfile.providerName === 'MSSQL';
		// TODO: The logic should from capabilities service.
		if (action) {
			let featureName: string = action.id;
			switch (featureName) {
				case Constants.BackupFeatureName:
					if (isMssql) {
						return connectionManagementInfo.connectionProfile.databaseName && !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				case Constants.RestoreFeatureName:
					if (isMssql) {
						return !isCloud;
					} else {
						return !!connectionManagementInfo.connectionProfile.databaseName;
					}
				default:
					return true;
			}
		} else {
			return true;
		}

	}
}
