/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as platform from 'vs/platform/registry/common/platform';
import { values } from 'vs/base/common/collections';
import { IComponent, ModelComponentTypes } from 'sql/platform/dashboard/browser/interfaces';

export type ComponentIdentifier = string;

export const Extensions = {
	ComponentContribution: 'dashboard.contributions.components'
};

interface ComponentCtor {
	new(...args: any[]): IComponent;
}

export interface IComponentRegistry {
	registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: ComponentCtor): ComponentIdentifier;
	getIdForTypeMapping(typeMapping: ModelComponentTypes): string;
	getCtorForType(typeMapping: ModelComponentTypes): ComponentCtor | undefined;
	getCtorFromId(id: string): ComponentCtor;
	getAllCtors(): Array<ComponentCtor>;
	getAllIds(): Array<string>;
}

class ComponentRegistry implements IComponentRegistry {
	private _idToCtor: { [x: string]: ComponentCtor } = {};
	private _typeNameToId: { [x: string]: string } = {};

	registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: ComponentCtor): string {
		this._idToCtor[id] = ctor;
		this._typeNameToId[ModelComponentTypes[typeMapping]] = id;
		return id;
	}

	public getIdForTypeMapping(typeMapping: ModelComponentTypes): string {
		return this._typeNameToId[ModelComponentTypes[typeMapping]];
	}

	public getCtorForType(typeMapping: ModelComponentTypes): ComponentCtor | undefined {
		let id = this.getIdForTypeMapping(typeMapping);
		return id ? this._idToCtor[id] : undefined;
	}
	public getCtorFromId(id: string): ComponentCtor {
		return this._idToCtor[id];
	}

	public getAllCtors(): Array<ComponentCtor> {
		return values(this._idToCtor);
	}

	public getAllIds(): Array<string> {
		return Object.keys(this._idToCtor);
	}

}

const componentRegistry = new ComponentRegistry();
platform.Registry.add(Extensions.ComponentContribution, componentRegistry);

export function registerComponentType(id: string, typeMapping: ModelComponentTypes, ctor: ComponentCtor): ComponentIdentifier {
	return componentRegistry.registerComponentType(id, typeMapping, ctor);
}
