/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

import * as core from 'sqlops';
import * as vscode from 'vscode';

declare module 'sqlops' {

	/**
	 * Supports defining a model that can be instantiated as a view in the UI
	 * @export
	 * @interface ModelBuilder
	 */
	export interface ModelBuilder {
		component<T extends Component>(componentTypeName: string): ComponentConfiguration<T>;
		navContainer(): NavContainerConfiguration;
		flexContainer(): FlexContainerConfiguration;
		card(): CardConfiguration;
		dashboardWidget(widgetId: string): ComponentConfiguration<WidgetComponent>;
		dashboardWebview(webviewId: string): ComponentConfiguration<WebviewComponent>;
	}

	export interface ComponentConfiguration<T extends Component> {
		withProperties<U>(properties: U): ComponentConfiguration<T>;
	}

	export interface ContainerConfiguration<T extends Component, U, V> extends ComponentConfiguration<T> {
		withLayout(layout: U): ContainerConfiguration<T,U,V>;
		addItem(component:ComponentConfiguration<any>, itemLayout ?: V): ContainerConfiguration<T,U,V>;
		withItems(components: Array<ComponentConfiguration<any>>, itemLayout ?: V): ContainerConfiguration<T,U,V>;
	}

	export interface NavContainerConfiguration extends ContainerConfiguration<NavContainer, any, any> {

	}

	export interface FlexContainerConfiguration extends ContainerConfiguration<FlexContainer, FlexLayout, FlexItemLayout> {

	}

	export interface CardConfiguration extends ComponentConfiguration<CardComponent> {
		withLabelValue(label: string, value: string): CardConfiguration;
		withActions(actions: ActionDescriptor[]): CardConfiguration;
	}

	export interface Component {
		readonly id: string;
		/**
		 * Sends any updated properties of the component to the UI
		 *
		 * @returns {Thenable<boolean>} Thenable that completes once the update
		 * has been applied in the UI
		 * @memberof Component
		 */
		updateProperties(): Thenable<boolean>;
	}

	/**
	 * A component that contains other components
	 */
	export interface Container<T,U> extends Component {
		/**
		 * Removes all child items from this container
		 *
		 * @returns {Thenable<void>} completion token resolved when the UI is updated
		 * @memberof Container
		 */
		clearItems(): Thenable<void>;
		/**
		 * A copy of the child items array. This cannot be added to directly -
		 * components must be created using the create methods instead
		 */
		readonly items: Component[];
		/**
		 * Creates a collection of child components and adds them all to this container
		 *
		 * @param itemConfigs the definitions
		 * @param {*} [itemLayout] Optional layout for the child items
		 */
		createItems(itemConfigs: Array<ComponentConfiguration<any>>, itemLayout ?: U): Thenable<Array<Component>>;

		/**
		 * Creates a child component and adds it to this container.
		 *
		 * @param {Component} component the component to be added
		 * @param {*} [itemLayout] Optional layout for this child item
		 */
		createItem(component: ComponentConfiguration<any>, itemLayout ?: U): Thenable<Component>;

		/**
		 * Defines the layout for this container
		 *
		 * @param {T} layout object
		 */
		setLayout(layout: T): Thenable<void>;
	}

	export interface NavContainer extends Container<any, any> {

	}

	/**
	 * The config for a FlexBox-based container. This supports easy
	 * addition of content to a container with a flexible layout
	 * and use of space.
	 */
	export interface FlexLayout {
		/**
		 * Matches the flex-flow CSS property and its available values.
		 * To layout as a vertical view use "column", and for horizontal
		 * use "row".
		 */
		flexFlow?: string;
		/**
		 * Matches the justify-content CSS property.
		 */
		justifyContent?: string;
	}

	export interface FlexItemLayout {
		/**
		 * Matches the order CSS property and its available values.
		 */
		order?: number;
		/**
		 * Matches the flex CSS property and its available values.
		 * Default is "0 1 auto".
		 */
		flex?: string;
	}

	export interface FlexContainer extends Container<FlexLayout, FlexItemLayout> {
	}

	/**
	 * Describes an action to be shown in the UI, with a user-readable label
	 * and a callback to execute the action
	 */
	export interface ActionDescriptor {
		/**
		 * User-visible label to display
		 */
		label: string;
		/**
		 * ID of the task to be called when this is clicked on.
		 * These should be registered using the {tasks.registerTask} API.
		 */
		taskId: string;
	}

	export interface CardComponent extends Component {
		label: string;
		value: string;
		actions: ActionDescriptor[];
	}

	export interface WidgetComponent extends Component {
		widgetId: string;
	}

	export interface WebviewComponent extends Component {
		webviewId: string;
	}

	/**
	 * A dashboard view backed by a model provided by an extension.
	 * This model contains enough information to lay out the view
	 */
	export interface DashboardModelView {
		/**
		 * Raised when the view closed.
		 */
		readonly onClosed: vscode.Event<any>;

		/**
		 * The connection info for the dashboard the webview exists on
		 */
		readonly connection: connection.Connection;

		/**
		 * The info on the server for the dashboard
		 */
		readonly serverInfo: ServerInfo;

		/**
		 * The model backing the model-based view
		 */
		readonly modelBuilder: ModelBuilder;

		/**
		 * Initializes the model with a root component definition.
		 * Once this has been done, the components will be laid out in the UI and
		 * can be accessed and altered as needed.
		 *
		 * @template T
		 * @param {ComponentConfiguration<T>} root
		 * @returns {Thenable<T>}
		 * @memberof DashboardModelView
		 */
		initializeModel<T extends Component>(root: ComponentConfiguration<T>): Thenable<T>;
	}

	export namespace dashboard {
		/**
		 * Register a provider for a model-view widget
		 */
		export function registerModelViewProvider(widgetId: string, handler: (view: DashboardModelView) => void): void;
	}
}
