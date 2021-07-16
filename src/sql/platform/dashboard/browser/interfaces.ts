/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';

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
	onComponentCreated,
	onCellAction,
	onEnterKeyPressed,
	onInput,
	onComponentLoaded
}

/**
 * Actions that can be handled by ModelView components
 */
export enum ModelViewAction {
	SelectTab = 'selectTab',
	AppendData = 'appendData',
	Filter = 'filter'
}

/**
 * Defines a component and can be used to map from the model-backed version of the
 * world to the frontend UI;
 *
 * @export
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
	/**
	 * Creates and saves the reference of a component descriptor.
	 * This can be used during creation of a component later
	 */
	createComponentDescriptor(type: string, createComponentDescriptor: string): IComponentDescriptor;
	/**
	 * gets the descriptor for a previously created component ID
	 */
	getComponentDescriptor(componentId: string): IComponentDescriptor;
	registerComponent(component: IComponent): void;
	unregisterComponent(component: IComponent): void;
	getComponent(componentId: string): IComponent | undefined;
	/**
	 * Runs on a component immediately if the component exists, or runs on
	 * registration of the component otherwise
	 *
	 * @param componentId unique identifier of the component
	 * @param action some action to perform
	 */
	eventuallyRunOnComponent<T>(componentId: string, action: (component: IComponent) => T, initial: boolean): void;
	/**
	 * Register a callback that will validate components when given a component ID
	 */
	registerValidationCallback(callback: (componentId: string) => Thenable<boolean>): void;
	/**
	 * Run all validations for the given component and return the new validation value
	 */
	validate(component: IComponent): Promise<boolean>;
}

/**
 * An instance of a model-backed component. This will be a UI element
 *
 * @export
 */
export interface IComponent extends IDisposable {
	descriptor: IComponentDescriptor;
	modelStore: IModelStore;
	layout(): void;
	registerEventHandler(handler: (event: IComponentEventArgs) => void): IDisposable;
	clearContainer?: () => void;
	/**
	 * Called when child components are added to this component
	 * @param items The list of items to add. Each item consists of a descriptor for identifying the component,
	 * the config defined and an optional index to insert it at
	 */
	addToContainer?: (items: { componentDescriptor: IComponentDescriptor, config: any, index?: number }[]) => void;
	removeFromContainer?: (componentDescriptor: IComponentDescriptor) => void;
	setLayout?: (layout: any) => void;
	setItemLayout?: (componentDescriptor: IComponentDescriptor, config: any) => void;
	getHtml: () => any;
	setProperties?: (properties: { [key: string]: any; }) => void;
	enabled: boolean;
	readonly valid?: boolean;
	validate(): Promise<boolean>;
	setDataProvider(handle: number, componentId: string, context: any): void;
	refreshDataProvider(item: any): void;
	focus(): void;
	doAction(action: string, ...args: any[]): void;
}

export enum ModelComponentTypes {
	NavContainer,
	DivContainer,
	FlexContainer,
	SplitViewContainer,
	Card,
	InputBox,
	DropDown,
	DeclarativeTable,
	ListBox,
	Button,
	CheckBox,
	RadioButton,
	WebView,
	Text,
	Table,
	DashboardWidget,
	DashboardWebview,
	Form,
	Group,
	Toolbar,
	LoadingComponent,
	TreeComponent,
	FileBrowserTree,
	Editor,
	DiffEditor,
	Hyperlink,
	Image,
	RadioCardGroup,
	ListView,
	TabbedPanel,
	Separator,
	PropertiesContainer,
	InfoBox,
	Slider
}
