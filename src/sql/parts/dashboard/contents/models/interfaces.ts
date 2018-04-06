/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * An instance of a model-backed component. This will be a UI element
 *
 * @export
 * @interface IComponent
 */
export interface IComponent {
	descriptor: IComponentDescriptor;
	modelStore: IModelStore;
	layout();
	clearContainer?: () => void;
	addToContainer?: (componentDescriptor: IComponentDescriptor, config: any) => void;
	setLayout?: (layout: any) => void;
	setProperties?: (properties: { [key: string]: any; }) => void;
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

export interface IModelStore {
	createComponentDescriptor(type: string): IComponentDescriptor;
	registerComponent(component: IComponent): void;
	unregisterComponent(component: IComponent): void;
	getComponent(componentDescriptor: IComponentDescriptor): IComponent;
}