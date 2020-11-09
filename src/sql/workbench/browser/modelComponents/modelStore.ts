/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from 'sql/base/common/promise';
import { entries } from 'sql/base/common/collections';
import { IComponentDescriptor, IModelStore, IComponent } from 'sql/platform/dashboard/browser/interfaces';

class ComponentDescriptor implements IComponentDescriptor {
	constructor(public readonly id: string, public readonly type: string) {

	}
}

export type ModelStoreAction<T> = (component: IComponent) => T;

export class ModelStore implements IModelStore {

	private _descriptorMappings: { [x: string]: IComponentDescriptor } = {};
	private _componentMappings: { [x: string]: IComponent } = {};
	private _componentActions: { [x: string]: { initial: ModelStoreAction<any>[], actions: Deferred<IComponent> } } = {};
	private _validationCallbacks: ((componentId: string) => Thenable<boolean>)[] = [];
	constructor() {
	}

	public createComponentDescriptor(type: string, id: string): IComponentDescriptor {
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
		this._componentActions[id] = undefined;
		this._descriptorMappings[id] = undefined;
		// TODO notify model for cleanup
	}

	getComponent(componentId: string): IComponent | undefined {
		return this._componentMappings[componentId];
	}

	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T, initial: boolean = false): void {
		let component = this.getComponent(componentId);
		if (component) {
			Promise.resolve(action(component));
		} else {
			this.addPendingAction(componentId, action, initial);
		}
	}

	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void {
		this._validationCallbacks.push(callback);
	}

	validate(component: IComponent): Thenable<boolean> {
		let componentId = entries(this._componentMappings).find(([id, mappedComponent]) => component === mappedComponent)[0];
		return Promise.all(this._validationCallbacks.map(callback => callback(componentId))).then(validations => validations.every(validation => validation === true));
	}

	private addPendingAction<T>(componentId: string, action: ModelStoreAction<T>, initial: boolean): void {
		// We create a promise and chain it onto a tracking promise whose resolve method
		// will only be called once the component is created
		let deferredActions = this._componentActions[componentId];
		if (!deferredActions) {
			deferredActions = { initial: [], actions: new Deferred() };
			this._componentActions[componentId] = deferredActions;
		}
		if (initial) {
			deferredActions.initial.push(action);
		} else {
			deferredActions.actions.promise.then((component) => {
				return action(component);
			});
		}
	}

	private runPendingActions(componentId: string, component: IComponent) {
		let promiseTracker = this._componentActions[componentId];
		if (promiseTracker) {
			// Run initial actions first to ensure they're done before later actions (and thus don't overwrite following actions)
			new Promise(resolve => {
				promiseTracker.initial.forEach(action => action(component));
				resolve();
			}).then(() => {
				promiseTracker.actions.resolve(component);
			});
			this._componentActions[componentId] = undefined;
		}
	}
}
