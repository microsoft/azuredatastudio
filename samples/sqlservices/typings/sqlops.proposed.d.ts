/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is the place for API experiments and proposal.

declare module 'sqlops' {
	import * as vscode from 'vscode';

	export interface ViewModelBuilder {

		createNavContainer(): NavContainer;
		createFlexContainer(): FlexContainer;
		createCard(): CardComponent;
		createDashboardWidget(id: string): CardComponent;
		createDashboardWebview(id: string): CardComponent;
	}

	export interface Component {
		id: string;
	}
	/**
	 * A component that contains other components
	 */
	export interface Container extends Component {
		/**
		 * Adds a collection of components.
		 *
		 * @param {Component[]} components the components to be added as children
		 * @param {*} [config] Optional configuration to define how the child items
		 * should be laid out
		 * @returns {Container} the original container, to support fluent-style API calls
		 */
		withComponents(components: Component[], config ?: any): Container;

		/**
		 * Adds a single component.
		 *
		 * @param {Component} component the component to be added
		 * @param {*} [config] Optional configuration to define how the child item
		 * should be laid out
		 * @returns {Container} the original container,to support fluent-style API calls
		 */
		addComponent(component: Component, config ?: any): Container;
	}

	export interface NavContainer extends Container {

	}

	/**
	 * The config for a FlexBox-based container. This supports easy
	 * addition of content to a container with a flexible layout
	 * and use of space.
	 */
	export interface FlexContainerConfig {
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

	export interface FlexItemConfig {
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

	export interface FlexContainer extends Container {
		/**
		 * Defines the layout for this flex container
		 *
		 * @param {FlexContainerConfig} layout
		 * @returns {FlexContainer} the original container, to support fluent-style API calls
		 */
		withLayout(layout: FlexContainerConfig): FlexContainer;
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

	export interface CardComponent {
		label: string;
		value: string;
		actions: ActionDescriptor[];
		withConfig(label: string, value: string, actions?: ActionDescriptor[]);
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
		readonly modelBuilder: ViewModelBuilder;

		model: Component;
	}

	export namespace dashboard {
		/**
		 * Register a provider for a model-view widget
		 */
		export function registerModelViewProvider(widgetId: string, handler: (view: DashboardModelView) => void): void;
	}
}