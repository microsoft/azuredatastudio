/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from 'sql/base/common/promise';
import { entries } from 'sql/base/common/collections';
import { find } from 'vs/base/common/arrays';
import { IComponentDescriptor, IModelStore, IComponent } from 'sql/platform/dashboard/browser/interfaces';

class ComponentDescriptor implements IComponentDescriptor {
	constructor(public readonly id: string, public readonly type: string) {

	}
}

export class ModelStore implements IModelStore {

	private _descriptorMappings: { [x: string]: IComponentDescriptor } = {};
	private _componentMappings: { [x: string]: IComponent } = {};
	private _componentActions: { [x: string]: Deferred<IComponent> } = {};
	private _componentInitializationActions: { [x: string]: Deferred<IComponent> } = {};
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

	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T, isInitialization: boolean = false): Promise<T> {
		let component = this.getComponent(componentId);
		if (component) {
			return Promise.resolve(action(component));
		} else {
			return this.addPendingAction(componentId, action, isInitialization);
		}
	}

	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void {
		this._validationCallbacks.push(callback);
	}

	validate(component: IComponent): Thenable<boolean> {
		let componentId = find(entries(this._componentMappings), ([id, mappedComponent]) => component === mappedComponent)[0];
		return Promise.all(this._validationCallbacks.map(callback => callback(componentId))).then(validations => validations.every(validation => validation === true));
	}

	private addPendingAction<T>(componentId: string, action: (component: IComponent) => T, isInitialization: boolean): Promise<T> {
		// We create a promise and chain it onto a tracking promise whose resolve method
		// will only be called once the component is created

		// If this is an initialization action we want to run it before the other actions that may have come in
		// after initialization but before the component was finished being created or we hit race conditions with
		// setting properties
		const actionsStore = isInitialization ? this._componentInitializationActions : this._componentActions;
		let deferredPromise = actionsStore[componentId];
		if (!deferredPromise) {
			deferredPromise = new Deferred();
			actionsStore[componentId] = deferredPromise;
		}
		let promise = deferredPromise.promise.then((component) => {
			return action(component);
		});
		return promise;
	}

	private runPendingActions(componentId: string, component: IComponent) {
		// If we have initialization actions to run start those first
		const initializationActionsPromise = this._componentInitializationActions[componentId];
		initializationActionsPromise?.resolve(component);
		const actionsPromise = this._componentActions[componentId];
		actionsPromise?.resolve(component);
	}
}
