/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Type } from '@angular/core';
import { IComponent } from 'sql/parts/dashboard/contents/models/interfaces';

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';

export type ComponentIdentifier = string;

export const Extensions = {
	ComponentContribution: 'dashboard.contributions.components'
};

export interface IComponentRegistry {
	registerComponentType(id: string, ctor: Type<IComponent>): ComponentIdentifier;
}

class ComponentRegistry implements IComponentRegistry {
	private _idToCtor: { [x: string]: Type<IComponent> } = {};

	registerComponentType(id: string, ctor: Type<IComponent>): string {
		this._idToCtor[id] = ctor;
		return id;
	}

}

const componentRegistry = new ComponentRegistry();
platform.Registry.add(Extensions.ComponentContribution, componentRegistry);

export function registerComponentType(id: string, ctor: Type<IComponent>): ComponentIdentifier {
	return componentRegistry.registerComponentType(id, ctor);
}
