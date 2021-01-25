/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Deferred } from 'sql/base/common/promise';
import { IComponentDescriptor, IModelStore, IComponent } from 'sql/platform/dashboard/browser/interfaces';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';

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
	constructor(private _logService: ILogService) {
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
		this._logService.debug(`Registering component ${component.descriptor.id}`);
		let id = component.descriptor.id;
		this._componentMappings[id] = component;
		this.runPendingActions(id, component);
	}

	unregisterComponent(component: IComponent): void {
		this._logService.debug(`Unregistering component ${component.descriptor.id}`);
		let id = component.descriptor.id;
		this._componentMappings[id] = undefined;
		this._componentActions[id] = undefined;
		this._descriptorMappings[id] = undefined;
		// TODO notify model for cleanup
	}

	getComponent(componentId: string): IComponent | undefined {
		return this._componentMappings[componentId];
	}

	/**
	 * Queues up an action to run once a component is created and registered. This will run immediately if the component is
	 * already registered.
	 * @param componentId The ID of the component to queue up the action for
	 * @param action The action to run when the component is registered
	 * @param initial Whether this is an initial setup action that should be done before other post-setup actions
	 */
	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T, initial: boolean = false): void {
		let component = this.getComponent(componentId);
		if (component) {
			action(component);
		} else {
			this.addPendingAction(componentId, action, initial);
		}
	}

	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void {
		this._validationCallbacks.push(callback);
	}

	async validate(component: IComponent): Promise<boolean> {
		const validations = await Promise.all(this._validationCallbacks.map(callback => callback(component.descriptor.id)));
		return validations.every(validation => validation === true);
	}

	/**
	 * Adds the specified action to the list of actions to run once the specified component is created and registered.
	 * @param componentId The ID of the component to add the action to
	 * @param action The action to run once the component is registered
	 * @param initial Whether this is an initial setup action that should be ran before other post-setup actions
	 */
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

	/**
	 * Runs the set of pending actions for a given component. This will run the initial setup actions
	 * first and then run all the other actions afterwards.
	 * @param componentId The ID of the component to run the currently pending actions for
	 * @param component The component object to run the actions against
	 */
	private runPendingActions(componentId: string, component: IComponent) {
		let promiseTracker = this._componentActions[componentId];
		if (promiseTracker) {
			// Run initial actions first to ensure they're done before later actions (and thus don't overwrite following actions)
			new Promise(resolve => {
				promiseTracker.initial.forEach(action => action(component));
				resolve();
			}).then(() => {
				promiseTracker.actions.resolve(component);
			}).catch(onUnexpectedError);
			this._componentActions[componentId] = undefined;
		}
	}
}
