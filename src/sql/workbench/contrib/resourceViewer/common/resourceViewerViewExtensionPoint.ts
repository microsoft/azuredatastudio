/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { Registry } from 'vs/platform/registry/common/platform';
import { IExtensionPoint, ExtensionsRegistry, ExtensionMessageCollector } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { ResourceViewerResourcesRegistry, Extensions } from 'sql/platform/resourceViewer/common/resourceViewerRegistry';

interface IUserFriendlyViewDescriptor {
	id: string;
	name: string;
	icon: string;
}

const viewDescriptor: IJSONSchema = {
	type: 'object',
	properties: {
		id: {
			description: localize('extension.contributes.resourceView.resource.id', "Identifier of the resource."),
			type: 'string'
		},
		name: {
			description: localize('extension.contributes.resourceView.resource.name', "The human-readable name of the view. Will be shown"),
			type: 'string'
		},
		icon: {
			description: localize('extension.contributes.resourceView.resource.icon', "Path to the resource icon."),
			type: 'string'
		},
	}
};

const resourceViewResourcesContribution: IJSONSchema = {
	description: localize('extension.contributes.resourceViewResources', "Contributes resource to the resource view"),
	type: 'array',
	items: viewDescriptor,
	default: []
};

const resourceViewExtensionPoint: IExtensionPoint<IUserFriendlyViewDescriptor[]> = ExtensionsRegistry.registerExtensionPoint<IUserFriendlyViewDescriptor[]>({ extensionPoint: 'resourceViewResources', jsonSchema: resourceViewResourcesContribution });

export class ResourceViewResourcesExtensionHandler implements IWorkbenchContribution {

	constructor() {
		this.handleAndRegisterCustomViews();
	}

	private handleAndRegisterCustomViews() {
		const resourceRegistry = Registry.as<ResourceViewerResourcesRegistry>(Extensions.ResourceViewerExtension);
		resourceViewExtensionPoint.setHandler(extensions => {
			for (let extension of extensions) {
				const { value, collector } = extension;

				for (const descriptor of value) {
					if (!this.isValidResource(descriptor, collector)) {
						return;
					}

					resourceRegistry.registerResource(descriptor);
				}
			}
		});
	}

	private isValidResource(descriptor: IUserFriendlyViewDescriptor, collector: ExtensionMessageCollector): boolean {
		if (typeof descriptor.id !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'id'));
			return false;
		}
		if (typeof descriptor.name !== 'string') {
			collector.error(localize('requirestring', "property `{0}` is mandatory and must be of type `string`", 'name'));
			return false;
		}
		if (typeof descriptor.icon !== 'string') {
			collector.error(localize('optstring', "property `{0}` can be omitted or must be of type `string`", 'icon'));
			return false;
		}

		return true;
	}
}
