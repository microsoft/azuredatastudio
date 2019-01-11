
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Registry } from 'vs/platform/registry/common/platform';

import * as sqlops from 'sqlops';
import { IModelStore, IComponentDescriptor, IComponent } from './interfaces';
import { Extensions, IComponentRegistry } from 'sql/platform/dashboard/common/modelComponentRegistry';
import { Deferred } from 'sql/base/common/promise';

const componentRegistry = <IComponentRegistry>Registry.as(Extensions.ComponentContribution);


class ComponentDescriptor implements IComponentDescriptor {
	constructor(public readonly id: string, public readonly type: string) {

	}
}

export class ModelStore implements IModelStore {
	private static baseId = 0;

	private _descriptorMappings: { [x: string]: IComponentDescriptor } = {};
	private _componentMappings: { [x: string]: IComponent } = {};
	private _componentActions: { [x: string]: Deferred<IComponent> } = {};
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

	getComponent(componentId: string): IComponent {
		return this._componentMappings[componentId];
	}

	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T): Promise<T> {
		let component = this.getComponent(componentId);
		if (component) {
			return Promise.resolve(action(component));
		} else {
			return this.addPendingAction(componentId, action);
		}
	}

	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void {
		this._validationCallbacks.push(callback);
	}

	validate(component: IComponent): Thenable<boolean> {
		let componentId = Object.entries(this._componentMappings).find(([id, mappedComponent]) => component === mappedComponent)[0];
		return Promise.all(this._validationCallbacks.map(callback => callback(componentId))).then(validations => validations.every(validation => validation === true));
	}

	private addPendingAction<T>(componentId: string, action: (component: IComponent) => T): Promise<T> {
		// We create a promise and chain it onto a tracking promise whose resolve method
		// will only be called once the component is created
		let deferredPromise = this._componentActions[componentId];
		if (!deferredPromise) {
			deferredPromise = new Deferred();
			this._componentActions[componentId] = deferredPromise;
		}
		let promise = deferredPromise.promise.then((component) => {
			return action(component);
		});
		return promise;
	}

	private runPendingActions(componentId: string, component: IComponent) {
		let promiseTracker = this._componentActions[componentId];
		if (promiseTracker) {
			promiseTracker.resolve(component);
		}
	}
}
