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
		inputBox(): ComponentBuilder<InputBoxComponent>;
		checkBox(): ComponentBuilder<CheckBoxComponent>;
		button(): ComponentBuilder<ButtonComponent>;
		dropDown(): ComponentBuilder<DropDownComponent>;
		dashboardWidget(widgetId: string): ComponentBuilder<WidgetComponent>;
		dashboardWebview(webviewId: string): ComponentBuilder<WebviewComponent>;
		formContainer(): FormBuilder;
	}

	export interface ComponentBuilder<T extends Component> {
		component(): T;
		withProperties<U>(properties: U): ComponentBuilder<T>;
		withValidation(validation: (component: T) => boolean): ComponentBuilder<T>;
	}
	export interface ContainerBuilder<T extends Component, TLayout, TItemLayout> extends ComponentBuilder<T> {
		withLayout(layout: TLayout): ContainerBuilder<T, TLayout, TItemLayout>;
		withItems(components: Array<Component>, itemLayout?: TItemLayout): ContainerBuilder<T, TLayout, TItemLayout>;
	}

	export interface FlexBuilder extends ContainerBuilder<FlexContainer, FlexLayout, FlexItemLayout> {

	}

	export interface FormBuilder extends ContainerBuilder<FormContainer, FormLayout, FormItemLayout> {
		withFormItems(components: FormComponent[], itemLayout?: FormItemLayout): ContainerBuilder<FormContainer, FormLayout, FormItemLayout>;
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

		enabled: boolean;
		/**
		 * Event fired to notify that the component's validity has changed
		 */
		readonly onValidityChanged: vscode.Event<boolean>;

		/**
		 * Whether the component is valid or not
		 */
		readonly valid: boolean;

		/**
		 * Run the component's validations
		 */
		validate(): Thenable<boolean>;
	}

	export interface FormComponent {
		component: Component;
		title: string;
		actions?: Component[];
	}

	/**
	 * A component that contains other components
	 */
	export interface Container<TLayout, TItemLayout> extends Component {
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
		addItems(itemConfigs: Array<Component>, itemLayout?: TItemLayout): void;

		/**
		 * Creates a child component and adds it to this container.
		 *
		 * @param {Component} component the component to be added
		 * @param {*} [itemLayout] Optional layout for this child item
		 */
		addItem(component: Component, itemLayout?: TItemLayout): void;

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
		/**
		 * Matches the align-items CSS property.
		 */
		alignItems?: string;
		/**
		 * Matches the align-content CSS property.
		 */
		alignContent?: string;
	}

	export interface FlexItemLayout {
		/**
		 * Matches the order CSS property and its available values.
		 */
		order?: number;
		/**
		 * Matches the flex CSS property and its available values.
		 * Default is "1 1 auto".
		 */
		flex?: string;
	}

	export interface FormItemLayout {
		horizontal: boolean;
		width: number;
		componentWidth: number;
	}

	export interface FormLayout {

	}

	export interface FlexContainer extends Container<FlexLayout, FlexItemLayout> {
	}

	export interface FormContainer extends Container<FormLayout, FormItemLayout> {
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
		 * Name of the clickable action. If not defined then no action will be shown
		 */
		actionTitle?: string;
		/**
		 * Data sent on callback being run.
		 */
		callbackData?: any;
	}

	/**
	 * Defines status indicators that can be shown to the user as part of
	 * components such as the Card UI
	 */
	export enum StatusIndicator {
		None = 0,
		Ok = 1,
		Warning = 2,
		Error = 3
	}

	/**
	 * Properties representing the card component, can be used
	 * when using ModelBuilder to create the component
	 */
	export interface CardProperties {
		label: string;
		value?: string;
		actions?: ActionDescriptor[];
		status?: StatusIndicator;
	}

	export type InputBoxInputType = 'color' | 'date' | 'datetime-local' | 'email' | 'month' | 'number' | 'password' | 'range' | 'search' | 'text' | 'time' | 'url' | 'week';

	export interface InputBoxProperties {
		value?: string;
		ariaLabel?: string;
		placeHolder?: string;
		height: number;
		width: number;
		inputType?: InputBoxInputType;
		required?: boolean;
	}

	export interface CheckBoxProperties {
		checked?: boolean;
		label?: string;
	}

	export interface DropDownProperties {
		value?: string;
		values?: string[];
	}

	export interface ButtonProperties {
		label?: string;
	}

	export interface CardComponent extends Component {
		label: string;
		value: string;
		actions?: ActionDescriptor[];
		onDidActionClick: vscode.Event<ActionDescriptor>;
	}

	export interface InputBoxComponent extends Component, InputBoxProperties {
		onTextChanged: vscode.Event<any>;
	}

	export interface CheckBoxComponent extends Component {
		checked: boolean;
		label: string;
		onChanged: vscode.Event<any>;
	}

	export interface DropDownComponent extends Component {
		value: string;
		values: string[];
		onValueChanged: vscode.Event<any>;
	}

	export interface ButtonComponent extends Component {
		label: string;
		onDidClick: vscode.Event<any>;
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
		 * Whether or not the model view's root component is valid
		 */
		readonly valid: boolean;

		/**
		 * Raised when the model view's valid property changes
		 */
		readonly onValidityChanged: vscode.Event<boolean>;

		/**
		 * Run the model view root component's validations
		 */
		validate(): Thenable<boolean>;

		/**
		 * Initializes the model with a root component definition.
		 * Once this has been done, the components will be laid out in the UI and
		 * can be accessed and altered as needed.
		 */
		initializeModel<T extends Component>(root: T): Thenable<void>;
	}

	export namespace ui {
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
			 * Create a dialog tab which can be included as part of the content of a dialog
			 * @param title The title of the page, displayed on the tab to select the page
			 */
			export function createTab(title: string): DialogTab;

			/**
			 * Create a button which can be included in a dialog
			 * @param label The label of the button
			 */
			export function createButton(label: string): Button;

			/**
			 * Opens the given dialog if it is not already open
			 */
			export function openDialog(dialog: Dialog): void;

			/**
			 * Closes the given dialog if it is open
			 */
			export function closeDialog(dialog: Dialog): void;

			export interface ModelViewPanel {
				/**
				 * Register model view content for the dialog.
				 * Doesn't do anything if model view is already registered
				 */
				registerContent(handler: (view: ModelView) => void): void;

				/**
				 * Returns the model view content if registered. Returns undefined if model review is not registered
				 */
				readonly modelView: ModelView;
			}

			// Model view dialog classes
			export interface Dialog extends ModelViewPanel {
				/**
				 * The title of the dialog
				 */
				title: string,

				/**
				 * The content of the dialog. If multiple tabs are given they will be displayed with tabs
				 * If a string is given, it should be the ID of the dialog's model view content
				 */
				content: string | DialogTab[],

				/**
				 * The ok button
				 */
				okButton: Button;

				/**
				 * The cancel button
				 */
				cancelButton: Button;

				/**
				 * Any additional buttons that should be displayed
				 */
				customButtons: Button[];

				/**
				 * Whether the dialog's content is valid
				 */
				readonly valid: boolean;

				/**
				 * Fired whenever the dialog's valid property changes
				 */
				readonly onValidityChanged: vscode.Event<boolean>;
			}

			export interface DialogTab extends ModelViewPanel {
				/**
				 * The title of the tab
				 */
				title: string;

				/**
				 * A string giving the ID of the tab's model view content
				 */
				content: string;
			}

			export interface Button {
				/**
				 * The label displayed on the button
				 */
				label: string;

				/**
				 * Whether the button is enabled
				 */
				enabled: boolean;

				/**
				 * Whether the button is hidden
				 */
				hidden: boolean;

				/**
				 * Raised when the button is clicked
				 */
				readonly onClick: vscode.Event<void>;
			}
		}
	}

	/**
	 * Namespace for interacting with query editor
	*/
	export namespace queryeditor {

		/**
		 * Make connection for the query editor
		 * @param {string} fileUri file URI for the query editor
		 * @param {string} connectionId connection ID
		 */
		export function connect(fileUri: string, connectionId: string): Thenable<void>;

		/**
		 * Run query if it is a query editor and it is already opened.
		 * @param {string} fileUri file URI for the query editor
		 */
		export function runQuery(fileUri: string): void;
	}

	/**
	 * Namespace for interacting with the workspace
	 */
	export namespace workspace {

		/**
		 * Create a new model view editor
		 */
		export function createModelViewEditor(title: string): ModelViewEditor;

		export interface ModelViewEditor extends window.modelviewdialog.ModelViewPanel {

			/**
			 * Opens the editor
			 */
			openEditor(position?: vscode.ViewColumn): Thenable<void>;
		}
	}
}
