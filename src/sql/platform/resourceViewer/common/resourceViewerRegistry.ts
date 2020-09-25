/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { Registry } from 'vs/platform/registry/common/platform';

export const Extensions = {
	ResourceViewerExtension: 'resourceViewer.resources'
};

export interface ResourceType {
	readonly id: string;
	readonly icon: string;
	readonly name: string;
}

export interface ResourceViewerResourcesRegistry {
	registerResource(resource: ResourceType): void;
	readonly allResources: ReadonlyArray<ResourceType>;
	readonly onDidRegisterResource: Event<void>;
}

const resourceViewerResourceRegistery = new class implements ResourceViewerResourcesRegistry {

	private readonly resources: ResourceType[] = [];
	private readonly _onDidRegisterResource = new Emitter<void>();
	public readonly onDidRegisterResource = this._onDidRegisterResource.event;

	public registerResource(resource: ResourceType): void {
		this.resources.push(Object.assign({}, resource));
		this._onDidRegisterResource.fire();
	}

	get allResources(): ReadonlyArray<ResourceType> {
		return this.resources;
	}
};

Registry.add(Extensions.ResourceViewerExtension, resourceViewerResourceRegistery);
