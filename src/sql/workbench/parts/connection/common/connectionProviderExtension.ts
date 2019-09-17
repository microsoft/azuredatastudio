/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';

import * as azdata from 'azdata';
import * as path from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';

export interface ConnectionProviderProperties {
	providerId: string;
	displayName: string;
	connectionOptions: azdata.ConnectionOption[];
}

export const Extensions = {
	ConnectionProviderContributions: 'connection.providers'
};

export interface IConnectionProviderRegistry {
	registerConnectionProvider(id: string, properties: ConnectionProviderProperties): void;
	getProperties(id: string): ConnectionProviderProperties | undefined;
	readonly onNewProvider: Event<{ id: string, properties: ConnectionProviderProperties }>;
	readonly providers: { [id: string]: ConnectionProviderProperties };
}

class ConnectionProviderRegistryImpl implements IConnectionProviderRegistry {
	private _providers = new Map<string, ConnectionProviderProperties>();
	private _onNewProvider = new Emitter<{ id: string, properties: ConnectionProviderProperties }>();
	public readonly onNewProvider: Event<{ id: string, properties: ConnectionProviderProperties }> = this._onNewProvider.event;

	public registerConnectionProvider(id: string, properties: ConnectionProviderProperties): void {
		this._providers.set(id, properties);
		this._onNewProvider.fire({ id, properties });
	}

	public getProperties(id: string): ConnectionProviderProperties | undefined {
		return this._providers.get(id);
	}

	public get providers(): { [id: string]: ConnectionProviderProperties } {
		let rt: { [id: string]: ConnectionProviderProperties } = {};
		this._providers.forEach((v, k) => {
			rt[k] = deepClone(v);
		});
		return rt;
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
		iconPath: {
			description: localize('schema.iconPath', "Icon path for the server type"),
			oneOf: [
				{
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: {
								type: 'string',
							},
							path: {
								type: 'object',
								properties: {
									light: {
										type: 'string',
									},
									dark: {
										type: 'string',
									}
								}
							}
						}
					}
				},
				{
					type: 'object',
					properties: {
						light: {
							type: 'string',
						},
						dark: {
							type: 'string',
						}
					}
				},
				{
					type: 'string'
				}
			]
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

ExtensionsRegistry.registerExtensionPoint<ConnectionProviderProperties | ConnectionProviderProperties[]>({ extensionPoint: 'connectionProvider', jsonSchema: ConnectionProviderContrib }).setHandler(extensions => {

	function handleCommand(contrib: ConnectionProviderProperties, extension: IExtensionPointUser<any>) {
		connectionRegistry.registerConnectionProvider(contrib.providerId, contrib);
	}

	for (let extension of extensions) {
		const { value } = extension;
		resolveIconPath(extension);
		if (Array.isArray<ConnectionProviderProperties>(value)) {
			for (let command of value) {
				handleCommand(command, extension);
			}
		} else {
			handleCommand(value, extension);
		}
	}
});

function resolveIconPath(extension: IExtensionPointUser<any>): void {
	if (!extension || !extension.value) { return undefined; }

	let toAbsolutePath = (iconPath: any, baseDir: string) => {
		if (!iconPath || !baseDir) { return; }
		if (Array.isArray(iconPath)) {
			for (let e of iconPath) {
				e.path = {
					light: URI.file(path.join(baseDir, e.path.light)),
					dark: URI.file(path.join(baseDir, e.path.dark))
				};
			}
		} else if (typeof iconPath === 'string') {
			iconPath = {
				light: URI.file(path.join(baseDir, iconPath)),
				dark: URI.file(path.join(baseDir, iconPath))
			};
		} else {
			iconPath = {
				light: URI.file(path.join(baseDir, iconPath.light)),
				dark: URI.file(path.join(baseDir, iconPath.dark))
			};
		}
	};

	let baseDir = extension.description.extensionLocation.fsPath;
	let properties: ConnectionProviderProperties = extension.value;
	if (Array.isArray<ConnectionProviderProperties>(properties)) {
		for (let p of properties) {
			toAbsolutePath(p['iconPath'], baseDir);
		}
	} else {
		toAbsolutePath(properties['iconPath'], baseDir);
	}
}
