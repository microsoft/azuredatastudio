/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionTreeDescriptor, IConnectionTreeService } from 'sql/workbench/services/connection/common/connectionTreeService';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { IDisposable } from 'vs/base/common/lifecycle';
import { isArray, isString } from 'vs/base/common/types';
import { localize } from 'vs/nls';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ExtensionsRegistry } from 'vs/workbench/services/extensions/common/extensionsRegistry';

const schema: IJSONSchema = {
	type: 'array',
	items: {
		type: 'object',
		properties: {
			name: {
				type: 'string',
				description: localize('connectionTreeProvider.schema.name', "User visible name for the tree provider")
			},
			id: {
				type: 'string',
				description: localize('connectionTreeProvider.schema.id', "Id for the provider, must be the same as when registering the tree data provider and must start with `connectionDialog/`")
			}
		}
	}
};

const connectionTreeProviderExt = ExtensionsRegistry.registerExtensionPoint<IConnectionTreeDescriptor[]>({ extensionPoint: 'connectionTreeProvider', jsonSchema: schema });

class ConnectionTreeProviderHandle implements IWorkbenchContribution {
	private disposables = new Map<IConnectionTreeDescriptor, IDisposable>();

	constructor(@IConnectionTreeService connectionTreeService: IConnectionTreeService) {
		connectionTreeProviderExt.setHandler((extensions, delta) => {

			function handleProvider(contrib: IConnectionTreeDescriptor) {
				return connectionTreeService.registerTreeDescriptor(contrib);
			}

			delta.added.forEach(added => {
				// resolveIconPath(added);
				if (!isArray(added.value)) {
					added.collector.error('Value must be array');
					return;
				}

				for (const provider of added.value) {
					if (!validateDescriptor(provider)) {
						added.collector.error('Invalid descriptor');
						continue;
					}
					this.disposables.set(provider, handleProvider(provider));
				}
			});

			delta.removed.forEach(removed => {
				for (const provider of removed.value) {
					this.disposables.get(provider)!.dispose();
				}
			});
		});
	}
}

function validateDescriptor(descriptor: IConnectionTreeDescriptor): boolean {
	if (!isString(descriptor.name)) {
		return false;
	}
	if (!isString(descriptor.id)) {
		return false;
	}
	return true;
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(ConnectionTreeProviderHandle, LifecyclePhase.Ready);
