/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProviderProperties } from 'sql/workbench/parts/connection/common/connectionProviderExtension';

import * as azdata from 'azdata';

import { Event } from 'vs/base/common/event';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'capabilitiesService';
export const HOST_NAME = 'azdata';
export const HOST_VERSION = '1.0';

export const clientCapabilities = {
	hostName: HOST_NAME,
	hostVersion: HOST_VERSION
};

export interface ProviderFeatures {
	connection: ConnectionProviderProperties;
}


export const ICapabilitiesService = createDecorator<ICapabilitiesService>(SERVICE_ID);

/**
 * Interface for managing provider capabilities
 */
export interface ICapabilitiesService {
	_serviceBrand: undefined;

	/**
	 * Retrieve a list of registered capabilities providers
	 */
	getCapabilities(provider: string): ProviderFeatures | undefined;

	/**
	 * get the old version of provider information
	 */
	getLegacyCapabilities(provider: string): azdata.DataProtocolServerCapabilities | undefined;

	/**
	 * Register a capabilities provider
	 */
	registerProvider(provider: azdata.CapabilitiesProvider): void;

	/**
	 * When new capabilities are registered, it emits the @see ProviderFeatures, which can be used to get the new capabilities
	 */
	readonly onCapabilitiesRegistered: Event<ProviderFeatures>;

	/**
	 * Get an array of all known providers
	 */
	readonly providers: { [id: string]: ProviderFeatures };

}
