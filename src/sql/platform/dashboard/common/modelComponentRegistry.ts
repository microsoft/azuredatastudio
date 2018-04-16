/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Type } from '@angular/core';
import { ModelComponentTypes } from 'sql/workbench/api/common/sqlExtHostTypes';

import * as platform from 'vs/platform/registry/common/platform';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import * as nls from 'vs/nls';
import { IComponent } from 'sql/parts/modelComponents/interfaces';

export type ComponentIdentifier = string;

export const Extensions = {
	ComponentContribution: 'dashboard.contributions.components'
};

export interface IComponentRegistry {
	registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: Type<IComponent>): ComponentIdentifier;
	getIdForTypeMapping(typeMapping: ModelComponentTypes): string;
	getCtorForType(typeMapping: ModelComponentTypes): Type<IComponent>;
	getCtorFromId(id: string): Type<IComponent>;
	getAllCtors(): Array<Type<IComponent>>;
	getAllIds(): Array<string>;
}

class ComponentRegistry implements IComponentRegistry {
	private _idToCtor: { [x: string]: Type<IComponent> } = {};
	private _typeNameToId: { [x: string]: string } = {};

	registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: Type<IComponent>): string {
		this._idToCtor[id] = ctor;
		this._typeNameToId[ModelComponentTypes[typeMapping]] = id;
		return id;
	}

	public getIdForTypeMapping(typeMapping: ModelComponentTypes): string {
		return this._typeNameToId[ModelComponentTypes[typeMapping]];
	}

	public getCtorForType(typeMapping: ModelComponentTypes): Type<IComponent> {
		let id = this.getIdForTypeMapping(typeMapping);
		return id ? this._idToCtor[id] : undefined;
	}
	public getCtorFromId(id: string): Type<IComponent> {
		return this._idToCtor[id];
	}

	public getAllCtors(): Array<Type<IComponent>> {
		return Object.values(this._idToCtor);
	}

	public getAllIds(): Array<string> {
		return Object.keys(this._idToCtor);
	}

}

const componentRegistry = new ComponentRegistry();
platform.Registry.add(Extensions.ComponentContribution, componentRegistry);

export function registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: Type<IComponent>): ComponentIdentifier {
	return componentRegistry.registerComponentType(id, typeMapping, ctor);
}
