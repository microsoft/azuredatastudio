/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { InjectionToken } from '@angular/core';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';

/**
 * An instance of a model-backed component. This will be a UI element
 *
 * @export
 * @interface IComponent
 */
export interface IComponent extends IDisposable {
	descriptor: IComponentDescriptor;
	modelStore: IModelStore;
	layout();
	registerEventHandler(handler: (event: IComponentEventArgs) => void): IDisposable;
	clearContainer?: () => void;
	addToContainer?: (componentDescriptor: IComponentDescriptor, config: any, index?: number) => void;
	removeFromContainer?: (componentDescriptor: IComponentDescriptor) => void;
	setLayout?: (layout: any) => void;
	setProperties?: (properties: { [key: string]: any; }) => void;
	enabled: boolean;
	readonly valid?: boolean;
	validate(): Thenable<boolean>;
	setDataProvider(handle: number, componentId: string, context: any): void;
	refreshDataProvider(item: any): void;
}

export const COMPONENT_CONFIG = new InjectionToken<IComponentConfig>('component_config');

export interface IComponentConfig {
	descriptor: IComponentDescriptor;
	modelStore: IModelStore;
}

/**
 * Defines a component and can be used to map from the model-backed version of the
 * world to the frontend UI;
 *
 * @export
 * @interface IComponentDescriptor
 */
export interface IComponentDescriptor {
	/**
	 * The type of this component. Used to map to the correct angular selector
	 * when loading the component
	 */
	type: string;
	/**
	 * A unique ID for this component
	 */
	id: string;
}

export interface IComponentEventArgs {
	eventType: ComponentEventType;
	args: any;
	componentId?: string;
}

export enum ComponentEventType {
	PropertiesChanged,
	onDidChange,
	onDidClick,
	validityChanged,
	onMessage,
	onSelectedRowChanged,
	onComponentCreated
}

export interface IModelStore {
	/**
	 * Creates and saves the reference of a component descriptor.
	 * This can be used during creation of a component later
	 */
	createComponentDescriptor(type: string, createComponentDescriptor): IComponentDescriptor;
	/**
	 * gets the descriptor for a previously created component ID
	 */
	getComponentDescriptor(componentId: string): IComponentDescriptor;
	registerComponent(component: IComponent): void;
	unregisterComponent(component: IComponent): void;
	getComponent(componentId: string): IComponent;
	/**
	 * Runs on a component immediately if the component exists, or runs on
	 * registration of the component otherwise
	 *
	 * @param {string} componentId unique identifier of the component
	 * @param {(component: IComponent) => void} action some action to perform
	 * @memberof IModelStore
	 */
	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T): Promise<T>;
	/**
	 * Register a callback that will validate components when given a component ID
	 */
	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void;
	/**
	 * Run all validations for the given component and return the new validation value
	 */
	validate(component: IComponent): Thenable<boolean>;
}
