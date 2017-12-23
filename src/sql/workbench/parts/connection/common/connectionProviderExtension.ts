/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';

export interface IConnectionOption {
	specialValueType: string;
	isIdentity: boolean;
	name: string;
	displayName: string;
	description: string;
	groupName: string;
	valueType: string;
	defaultValue: any;
	objectType: any;
	categoryValues: any;
	isRequired: boolean;
	isArray: boolean;
}

export interface ConnectionProviderProperties {
	providerId: string;
	displayName: string;
	connectionOptions: IConnectionOption[];
}


export const Extensions = {
	ConnectionProviderContributions: 'connection.providers'
};

export interface IConnectionProviderRegistry {
	registerConnectionProvider(id: string, properties: ConnectionProviderProperties): void;
	getProperties(id: string): ConnectionProviderProperties;
	readonly onNewProvider: Event<{id: string, properties: ConnectionProviderProperties}>;
	readonly providers: {id: string, properties: ConnectionProviderProperties}[];
}

class ConnectionProviderRegistryImpl implements IConnectionProviderRegistry {
	private _providers = new Map<string, ConnectionProviderProperties>();
	private _onNewProvider = new Emitter<{id: string, properties: ConnectionProviderProperties}>();
	public readonly onNewProvider: Event<{id: string, properties: ConnectionProviderProperties}> = this._onNewProvider.event;

	public registerConnectionProvider(id: string, properties: ConnectionProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({id, properties});
	}

	public getProperties(id: string): ConnectionProviderProperties {
		return this._providers.get(id);
	}

	public get providers(): {id: string, properties: ConnectionProviderProperties}[] {
		const out = [];
		this._providers.forEach((v, k) => {
			out.push({id: k, propreties: v});
		});
		return out;
	}
}

const connectionRegistry = new ConnectionProviderRegistryImpl();
Registry.add(Extensions.ConnectionProviderContributions, connectionRegistry);

const ConnectionProviderContrib: IJSONSchema = {
	type: 'object',
	properties: {
		providerId: {
			type: 'string',
			description: localize('schema.providerId', "Common id for the provider")
		},
		displayName: {
			type: 'string',
			description: localize('schema.displayName', "Display Name for the provider")
		},
		connectionOptions: {
			type: 'array',
			description: localize('schema.connectionOptions', "Options for connection"),
			items: {
				type: 'object',
				properties: {
					specialValueType: {
						type: 'string'
					},
					isIdentity: {
						type: 'boolean'
					},
					name: {
						type: 'string'
					},
					displayName: {
						type: 'string'
					},
					description: {
						type: 'string'
					},
					groupName: {
						type: 'string'
					},
					valueType: {
						type: 'string'
					},
					defaultValue: {
						type: 'any'
					},
					objectType: {
						type: 'any'
					},
					categoryValues: {
						type: 'any'
					},
					isRequired: {
						type: 'boolean'
					},
					isArray: {
						type: 'bolean'
					}
				}
			}
		}
	},
	required: ['providerId']
};

ExtensionsRegistry.registerExtensionPoint<ConnectionProviderProperties | ConnectionProviderProperties[]>('connectionProvider', [], ConnectionProviderContrib).setHandler(extensions => {

	function handleCommand(contrib: ConnectionProviderProperties, extension: IExtensionPointUser<any>) {
		connectionRegistry.registerConnectionProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<ConnectionProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
