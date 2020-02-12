/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionPointUser, ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';

import * as resources from 'vs/base/common/resources';
import { ConnectionProviderProperties, ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import type { IDisposable } from 'vs/base/common/lifecycle';
import { isArray } from 'vs/base/common/types';

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
						type: ['string', 'number', 'boolean', 'object', 'integer', 'null', 'array']
					},
					defaultValueOsOverrides: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								os: {
									type: 'string',
									enum: ['Windows', 'Macintosh', 'Linux']
								},
								defaultValueOverride: {
									type: ['string', 'number', 'boolean', 'object', 'integer', 'null', 'array']
								}
							}
						}
					},
					objectType: {
						type: ['string', 'number', 'boolean', 'object', 'integer', 'null', 'array']
					},
					categoryValues: {
						type: ['string', 'number', 'boolean', 'object', 'integer', 'null', 'array']
					},
					isRequired: {
						type: 'boolean'
					},
					isArray: {
						type: 'boolean'
					}
				}
			}
		}
	},
	required: ['providerId']
};

const connectionProviderExtPoint = ExtensionsRegistry.registerExtensionPoint<ConnectionProviderProperties | ConnectionProviderProperties[]>({ extensionPoint: 'connectionProvider', jsonSchema: ConnectionProviderContrib });

class ConnectionProviderHandler implements IWorkbenchContribution {
	private disposables = new Map<ConnectionProviderProperties, IDisposable>();

	constructor(@ICapabilitiesService capabilitiesService: ICapabilitiesService) {
		connectionProviderExtPoint.setHandler((extensions, delta) => {

			function handleProvider(contrib: ConnectionProviderProperties) {
				return capabilitiesService.registerConnectionProvider(contrib.providerId, contrib);
			}

			delta.added.forEach(added => {
				resolveIconPath(added);
				if (isArray(added.value)) {
					for (const provider of added.value) {
						this.disposables.set(provider, handleProvider(provider));
					}
				} else {
					this.disposables.set(added.value, handleProvider(added.value));
				}
			});
			delta.removed.forEach(removed => {
				if (isArray(removed.value)) {
					for (const provider of removed.value) {
						this.disposables.get(provider)!.dispose();
					}
				} else {
					this.disposables.get(removed.value)!.dispose();
				}
			});
		});
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ConnectionProviderHandler, LifecyclePhase.Restored);

function resolveIconPath(extension: IExtensionPointUser<any>): void {
	if (!extension || !extension.value) { return undefined; }

	let toAbsolutePath = (iconPath: any) => {
		if (!iconPath || !baseDir) { return; }
		if (Array.isArray(iconPath)) {
			for (let e of iconPath) {
				e.path = {
					light: resources.joinPath(extension.description.extensionLocation, e.path.light.toString()),
					dark: resources.joinPath(extension.description.extensionLocation, e.path.dark.toString())
				};
			}
		} else if (typeof iconPath === 'string') {
			iconPath = {
				light: resources.joinPath(extension.description.extensionLocation, iconPath),
				dark: resources.joinPath(extension.description.extensionLocation, iconPath)
			};
		} else {
			iconPath = {
				light: resources.joinPath(extension.description.extensionLocation, iconPath.light.toString()),
				dark: resources.joinPath(extension.description.extensionLocation, iconPath.dark.toString())
			};
		}
	};

	let baseDir = extension.description.extensionLocation.fsPath;
	let properties: ConnectionProviderProperties = extension.value;
	if (Array.isArray<ConnectionProviderProperties>(properties)) {
		for (let p of properties) {
			toAbsolutePath(p['iconPath']);
		}
	} else {
		toAbsolutePath(properties['iconPath']);
	}
}
