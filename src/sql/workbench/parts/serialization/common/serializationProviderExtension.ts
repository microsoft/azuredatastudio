/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';
import { clone } from 'vs/base/common/objects';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';

export interface SerializationProviderProperties {
	providerId: string;
	displayName: string;
}

export const Extensions = {
	SerializationProviderContributions: 'serialization.providers'
};

export interface ISerializationProviderRegistry {
	registerSerializationProvider(id: string, properties: SerializationProviderProperties): void;
	getProperties(id: string): SerializationProviderProperties;
	readonly onNewProvider: Event<{ id: string, properties: SerializationProviderProperties }>;
	readonly providers: { [id: string]: SerializationProviderProperties };
}

class SerializationProviderRegistryImpl implements ISerializationProviderRegistry {
	private _providers = new Map<string, SerializationProviderProperties>();
	private _onNewProvider = new Emitter<{ id: string, properties: SerializationProviderProperties }>();
	public readonly onNewProvider: Event<{ id: string, properties: SerializationProviderProperties }> = this._onNewProvider.event;

	public registerSerializationProvider(id: string, properties: SerializationProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({ id, properties });
	}

	public getProperties(id: string): SerializationProviderProperties {
		return this._providers.get(id);
	}

	public get providers(): { [id: string]: SerializationProviderProperties } {
		let rt: { [id: string]: SerializationProviderProperties } = {};
		this._providers.forEach((v, k) => {
			rt[k] = clone(v);
		});
		return rt;
	}
}

const serializationRegistry = new SerializationProviderRegistryImpl();
Registry.add(Extensions.SerializationProviderContributions, serializationRegistry);

const SerializationProviderContrib: IJSONSchema = {
	type: 'object',
	properties: {
		providerId: {
			type: 'string',
			description: localize('schema.providerId', "Common id for the provider")
		},
		displayName: {
			type: 'string',
			description: localize('schema.displayName', "Display Name for the provider")
		}
	},
	required: ['providerId']
};


ExtensionsRegistry.registerExtensionPoint<SerializationProviderProperties | SerializationProviderProperties[]>('serializationProvider', [], SerializationProviderContrib).setHandler(extensions => {

	function handleCommand(contrib: SerializationProviderProperties, extension: IExtensionPointUser<any>) {
		serializationRegistry.registerSerializationProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<SerializationProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
