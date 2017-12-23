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

export interface BackupProviderProperties {
	providerId: string;
	displayName: string;
	connectionOptions: IConnectionOption[];
}


export const Extensions = {
	BackupProviderContributions: 'backup.providers'
};

export interface IBackupProviderRegistry {
	registerBackupProvider(id: string, properties: BackupProviderProperties): void;
	getProperties(id: string): BackupProviderProperties;
	readonly onNewProvider: Event<{ id: string, properties: BackupProviderProperties }>;
	readonly providers: { id: string, properties: BackupProviderProperties }[];
}

class BackupProviderRegistryImpl implements IBackupProviderRegistry {
	private _providers = new Map<string, BackupProviderProperties>();
	private _onNewProvider = new Emitter<{ id: string, properties: BackupProviderProperties }>();
	public readonly onNewProvider: Event<{ id: string, properties: BackupProviderProperties }> = this._onNewProvider.event;

	public registerBackupProvider(id: string, properties: BackupProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({ id, properties });
	}

	public getProperties(id: string): BackupProviderProperties {
		return this._providers.get(id);
	}

	public get providers(): { id: string, properties: BackupProviderProperties }[] {
		const out = [];
		this._providers.forEach((v, k) => {
			out.push({ id: k, propreties: v });
		});
		return out;
	}
}

const backupRegistry = new BackupProviderRegistryImpl();
Registry.add(Extensions.BackupProviderContributions, backupRegistry);

const BackupProviderContrib: IJSONSchema = {
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

/* Saved for later
ExtensionsRegistry.registerExtensionPoint<BackupProviderProperties | BackupProviderProperties[]>('backupProvider', [], BackupProviderContrib).setHandler(extensions => {

	function handleCommand(contrib: BackupProviderProperties, extension: IExtensionPointUser<any>) {
		backupRegistry.registerBackupProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		if (Array.isArray<BackupProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});
*/
