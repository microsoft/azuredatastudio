/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/platform/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';

import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import * as data from 'data';

export interface IRestoreOption {
	name: string;
	displayName: string;
	description: string;
	groupName: string;
	valueType: ServiceOptionType;
	defaultValue: any;
	objectType: string;
	categoryValues: data.CategoryValue[];
	isRequired: boolean;
	isArray: boolean;
}

export interface RestoreProviderProperties {
	providerId: string;
	displayName: string;
	restoreOptions: IRestoreOption[];
}

export const Extensions = {
	RestoreProviderContributions: 'restore.providers'
};

export interface IRestoreProviderRegistry {
	registerRestoreProvider(id: string, properties: RestoreProviderProperties): void;
	getProperties(id: string): RestoreProviderProperties;
	readonly onNewProvider: Event<{id: string, properties: RestoreProviderProperties}>;
	readonly providers: {id: string, properties: RestoreProviderProperties}[];
}

class RestoreProviderRegistryImpl implements IRestoreProviderRegistry {
	private _providers = new Map<string, RestoreProviderProperties>();
	private _onNewProvider = new Emitter<{id: string, properties: RestoreProviderProperties}>();
	public readonly onNewProvider: Event<{id: string, properties: RestoreProviderProperties}> = this._onNewProvider.event;

	public registerRestoreProvider(id: string, properties: RestoreProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({id, properties});
	}

	public getProperties(id: string): RestoreProviderProperties {
		return this._providers.get(id);
	}

	public get providers(): {id: string, properties: RestoreProviderProperties}[] {
		const out = [];
		this._providers.forEach((v, k) => {
			out.push({id: k, propreties: v});
		});
		return out;
	}
}

const restoreRegistry = new RestoreProviderRegistryImpl();
Registry.add(Extensions.RestoreProviderContributions, restoreRegistry);

const RestoreProviderContrib: IJSONSchema = {
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
		restoreOptions: {
			type: 'array',
			description: localize('schema.connectionOptions', "Options for connection"),
			items: {
				type: 'object',
				properties: {
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
						type: 'string',
						enum: ['string', 'number', 'object', 'multistring', 'password', 'category', 'boolean']
					},
					defaultValue: {
						type: 'any'
					},
					objectType: {
						type: 'any'
					},
					categoryValues: {
						type: 'object',
						properties: {
							displayName: {
								type: 'string'
							},
							name: {
								type: 'string'
							}
						}
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

ExtensionsRegistry.registerExtensionPoint<RestoreProviderProperties | RestoreProviderProperties[]>('restoreProvider', [], RestoreProviderContrib).setHandler(extensions => {

	function handleCommand(contrib: RestoreProviderProperties, extension: IExtensionPointUser<any>) {
		restoreRegistry.registerRestoreProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<RestoreProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
