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
		navContainer(): ContainerBuilder<NavContainer, any, any>;
		flexContainer(): FlexBuilder;
		card(): ComponentBuilder<CardComponent>;
		dashboardWidget(widgetId: string): ComponentBuilder<WidgetComponent>;
		dashboardWebview(webviewId: string): ComponentBuilder<WebviewComponent>;
	}

	export interface ComponentBuilder<T extends Component> {
		component(): T;
		withProperties<U>(properties: U): ComponentBuilder<T>;
	}
	export interface ContainerBuilder<T extends Component, TLayout,TItemLayout> extends ComponentBuilder<T> {
		withLayout(layout: TLayout): ContainerBuilder<T, TLayout, TItemLayout>;
		withItems(components: Array<Component>, itemLayout ?: TItemLayout): ContainerBuilder<T, TLayout, TItemLayout>;
	}

	export interface FlexBuilder extends ContainerBuilder<FlexContainer, FlexLayout, FlexItemLayout> {

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
		updateProperties(properties: { [key: string]: any }): Thenable<boolean>;
	}

	/**
	 * A component that contains other components
	 */
	export interface Container<TLayout,TItemLayout> extends Component {
		/**
		 * A copy of the child items array. This cannot be added to directly -
		 * components must be created using the create methods instead
		 */
		readonly items: Component[];

		/**
		 * Removes all child items from this container
		 */
		clearItems(): void;
		/**
		 * Creates a collection of child components and adds them all to this container
		 *
		 * @param itemConfigs the definitions
		 * @param {*} [itemLayout] Optional layout for the child items
		 */
		addItems(itemConfigs: Array<Component>, itemLayout ?: TItemLayout): void;

		/**
		 * Creates a child component and adds it to this container.
		 *
		 * @param {Component} component the component to be added
		 * @param {*} [itemLayout] Optional layout for this child item
		 */
		addItem(component: Component, itemLayout ?: TItemLayout): void;

		/**
		 * Defines the layout for this container
		 *
		 * @param {TLayout} layout object
		 */
		setLayout(layout: TLayout): void;
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

	/**
	 * Properties representing the card component, can be used
	 * when using ModelBuilder to create the comopnent
	 */
	export interface CardProperties  {
		label: string;
		value?: string;
		actions?: ActionDescriptor[];
	}

	export interface CardComponent extends Component {
		label: string;
		value: string;
		actions?: ActionDescriptor[];
	}

	export interface WidgetComponent extends Component {
		widgetId: string;
	}

	export interface WebviewComponent extends Component {
		webviewId: string;
	}

	/**
	 * A view backed by a model provided by an extension.
	 * This model contains enough information to lay out the view
	 */
	export interface ModelView {
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
		 */
		initializeModel<T extends Component>(root: T): Thenable<void>;
	}

	export namespace dashboard {
		/**
		 * Register a provider for a model-view widget
		 */
		export function registerModelViewProvider(widgetId: string, handler: (view: ModelView) => void): void;
	}

	export namespace window {
		export namespace modelviewdialog {
			/**
			 * Create a dialog with the given title
			 * @param title The title of the dialog, displayed at the top
			 */
			export function createDialog(title: string): Dialog;

			/**
			 * Create a dialog page which can be included as part of the content of a dialog
			 * @param title The title of the page, displayed on the tab to select the page
			 */
			export function createPage(title: string): DialogPage;

			// Model view dialog classes
			export interface Dialog {
				/**
				 * The title of the dialog
				 */
				title: string,

				/**
				 * The content of the dialog. If multiple pages are given they will be displayed with tabs
				 * TODO: Use a model view content type instead of ServiceOption
				 */
				content: ServiceOption[] | DialogPage[],

				/**
				 * The caption of the OK button
				 */
				okTitle: string;

				/**
				 * The caption of the Cancel button
				 */
				cancelTitle: string;

				/**
				 * Any additional buttons that should be displayed
				 */
				customButtons: Button[];

				/**
				 * Opens the dialog
				 */
				open(): void;

				/**
				 * Closes the dialog
				 */
				close(): void;

				/**
				 * Updates the dialog on screen to reflect changes to the buttons or content
				 */
				updateContent(): void;

				/**
				 * Raised when dialog's ok button is pressed
				 */
				readonly onOk: vscode.Event<void>;

				/**
				 * Raised when dialog is canceled
				 */
				readonly onCancel: vscode.Event<void>;
			}

			export interface DialogPage {
				/**
				 * The title of the tab
				 */
				title: string,

				/**
				 * The tab's content
				 * TODO: use a model view content type
				 */
				content: ServiceOption[];

				/**
				 * Updates the dialog on screen to reflect changes to the content
				 */
				updateContent(): void;
			}

			export interface Button {
				/**
				 * The label displayed on the button
				 */
				label: string,

				/**
				 * A function that will be called when the button is clicked
				 */
				onClick: () => void;
			}
		}
	}
}
