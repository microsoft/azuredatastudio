
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Registry } from 'vs/platform/registry/common/platform';

import * as sqlops from 'sqlops';
import { IModelStore, IComponentDescriptor, IComponent } from './interfaces';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';

const componentRegistry = <IComponentRegistry> Registry.as(Extensions.ComponentContribution);
interface IComponentAction { (component: IComponent): void; }

class ComponentDescriptor implements IComponentDescriptor {
	constructor(public readonly id: string, public readonly type: string) {

	}
}

export class ModelStore implements IModelStore {
	private static baseId = 0;

	private storeId: number;
	private nextComponentId: number;
	private _descriptorMappings: { [x: string]: IComponentDescriptor } = {};
	private _componentMappings: { [x: string]: IComponent } = {};
	private _componentActions: { [x: string]: IComponentAction[] } = {};
	constructor() {
		this.storeId = ModelStore.baseId++;
		this.nextComponentId = 0;
	}

	private getNextComponentId(): string {
		return `component${this.storeId}_${this.nextComponentId++}`;
	}

	public createComponentDescriptor(type: string): IComponentDescriptor {
		let id = this.getNextComponentId();
		let descriptor = new ComponentDescriptor(id, type);
		this._descriptorMappings[id] = descriptor;
		return descriptor;
	}

	getComponentDescriptor(id: string): IComponentDescriptor {
		return this._descriptorMappings[id];
	}

	registerComponent(component: IComponent): void {
		let id = component.descriptor.id;
		this._componentMappings[id] = component;
		this.runPendingActions(id, component);
	}

	unregisterComponent(component: IComponent): void {
		let id = component.descriptor.id;
		this._componentMappings[id] = undefined;
		this._componentActions[id] = [];
		// TODO notify model for cleanup
	}

	getComponent(componentId: string): IComponent {
		return this._componentMappings[componentId];
	}

	eventuallyRunOnComponent(componentId: string, action: (component: IComponent) => void): void {
		let component = this.getComponent(componentId);
		if (component) {
			action(component);
		} else {
			this.addPendingAction(componentId, action);
		}
	}

	private addPendingAction(componentId: string, action: (component: IComponent) => void) {
		let actions = this._componentActions[componentId];
		if (!actions) {
			actions = [];
		}
		actions.push(action);
		this._componentActions[componentId] = actions;
	}

	private runPendingActions(componentId: string, component: IComponent) {
		let actions = this._componentActions[componentId];
		if (actions) {
			for (let action of actions) {
				action(component);
			}
		}
		this._componentActions[componentId] = [];
	}
}
