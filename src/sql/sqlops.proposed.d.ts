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
		radioButton(): ComponentBuilder<RadioButtonComponent>;
		webView(): ComponentBuilder<WebViewComponent>;
		text(): ComponentBuilder<TextComponent>;
		button(): ComponentBuilder<ButtonComponent>;
		dropDown(): ComponentBuilder<DropDownComponent>;
		listBox(): ComponentBuilder<ListBoxComponent>;
		table(): ComponentBuilder<TableComponent>;
		declarativeTable(): ComponentBuilder<DeclarativeTableComponent>;
		dashboardWidget(widgetId: string): ComponentBuilder<DashboardWidgetComponent>;
		dashboardWebview(webviewId: string): ComponentBuilder<DashboardWebviewComponent>;
		formContainer(): FormBuilder;
		groupContainer(): GroupBuilder;
		toolbarContainer(): ToolbarBuilder;
		loadingComponent(): LoadingComponentBuilder;
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

	export interface GroupBuilder extends ContainerBuilder<GroupContainer, GroupLayout, GroupItemLayout> {
	}

	export interface ToolbarBuilder extends ContainerBuilder<ToolbarContainer, any, any> {
		withToolbarItems(components: ToolbarComponent[]): ContainerBuilder<ToolbarContainer, any, any>;

		/**
		 * Creates a collection of child components and adds them all to this container
		 *
		 * @param toolbarComponents the definitions
		 */
		addToolbarItems(toolbarComponents: Array<ToolbarComponent>): void;

		/**
		 * Creates a child component and adds it to this container.
		 *
		 * @param toolbarComponent the component to be added
		 */
		addToolbarItem(toolbarComponent: ToolbarComponent): void;
	}

	export interface LoadingComponentBuilder extends ComponentBuilder<LoadingComponent> {
		/**
		 * Set the component wrapped by the LoadingComponent
		 * @param component The component to wrap
		 */
		withItem(component: Component): LoadingComponentBuilder;
	}

	export interface FormBuilder extends ContainerBuilder<FormContainer, FormLayout, FormItemLayout> {
		withFormItems(components: FormComponent[], itemLayout?: FormItemLayout): ContainerBuilder<FormContainer, FormLayout, FormItemLayout>;

		/**
		 * Creates a collection of child components and adds them all to this container
		 *
		 * @param formComponents the definitions
		 * @param {*} [itemLayout] Optional layout for the child items
		 */
		addFormItems(formComponents: Array<FormComponent>, itemLayout?: FormItemLayout): void;

		/**
		 * Creates a child component and adds it to this container.
		 *
		 * @param formComponent the component to be added
		 * @param {*} [itemLayout] Optional layout for this child item
		 */
		addFormItem(formComponent: FormComponent, itemLayout?: FormItemLayout): void;
	}

	export interface Component {
		readonly id: string;

		/**
		 * Sends any updated properties of the component to the UI
		 *
		 * @returns {Thenable<void>} Thenable that completes once the update
		 * has been applied in the UI
		 * @memberof Component
		 */
		updateProperties(properties: { [key: string]: any }): Thenable<void>;

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

	export interface ToolbarComponent {
		component: Component;
		title?: string;
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

		/**
		 * Container Height
		 */
		height?: number | string;

		/**
		 * Container Width
		 */
		width?: number | string;

		/**
		 *
		 */
		textAlign?: string
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
		horizontal?: boolean;
		componentWidth?: number | string;
		componentHeight?: number | string;
	}

	export interface FormLayout {
		width?: number | string;
		height?: number | string;
	}

	export interface GroupLayout {
		width?: number | string;
		header?: string;
	}

	export interface GroupItemLayout {
	}

	export interface FlexContainer extends Container<FlexLayout, FlexItemLayout> {
	}

	export interface FormContainer extends Container<FormLayout, FormItemLayout> {
	}

	export interface GroupContainer extends Container<GroupLayout, GroupItemLayout> {
	}

	export interface ToolbarContainer extends Container<any, any> {
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

	export interface ComponentProperties {
		height?: number | string;
		width?: number | string;
	}

	export interface InputBoxProperties extends ComponentProperties {
		value?: string;
		ariaLabel?: string;
		placeHolder?: string;
		inputType?: InputBoxInputType;
		required?: boolean;
		multiline?: boolean;
		rows?: number;
		columns?: number;
		min?: number;
		max?: number;
	}

	export interface TableColumn {
		value: string
	}

	export interface TableComponentProperties extends ComponentProperties {
		data: any[][];
		columns: string[] | TableColumn[];
		selectedRows?: number[];
	}

	export interface CheckBoxProperties {
		checked?: boolean;
		label?: string;
	}

	export enum DeclarativeDataType {
		string = 'string',
		category = 'category',
		boolean = 'boolean'
	}

	export interface RadioButtonProperties {
		name?: string;
		label?: string;
		value?: string;
		checked?: boolean;
	}

	export interface TextComponentProperties {
		value?: string;
	}

	export interface DropDownProperties extends ComponentProperties {
		value?: string | CategoryValue;
		values?: string[] | CategoryValue[];
		editable?: boolean;
	}

	export interface DeclarativeTableColumn {
		displayName: string;
		categoryValues: CategoryValue[];
		valueType: DeclarativeDataType;
		isReadOnly: boolean;
		width: number | string;
	}

	export interface DeclarativeTableProperties {
		data: any[][];
		columns: DeclarativeTableColumn[];
	}

	export interface ListBoxProperties {
		selectedRow?: number;
		values?: string[];

	}

	export interface WebViewProperties {
		message?: any;
		html?: string;
	}

	export interface ButtonProperties extends ComponentProperties {
		label?: string;
		iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri };
	}

	export interface LoadingComponentProperties {
		loading?: boolean;
	}

	export interface CardComponent extends Component {
		label: string;
		value: string;
		actions?: ActionDescriptor[];
		onDidActionClick: vscode.Event<ActionDescriptor>;
	}

	export interface TextComponent extends Component {
		value: string;
	}

	export interface InputBoxComponent extends Component, InputBoxProperties {
		onTextChanged: vscode.Event<any>;
	}

	export interface RadioButtonComponent extends Component, RadioButtonProperties {
		onDidClick: vscode.Event<any>;
	}

	export interface CheckBoxComponent extends Component {
		checked: boolean;
		label: string;
		onChanged: vscode.Event<any>;
	}

	export interface DropDownComponent extends Component, DropDownProperties {
		value: string | CategoryValue;
		values: string[] | CategoryValue[];
		onValueChanged: vscode.Event<any>;
	}

	export interface TableCell {
		row: number;
		column: number;
		value: any;
	}

	export interface DeclarativeTableComponent extends Component, DeclarativeTableProperties {
		onDataChanged: vscode.Event<any>;
	}

	export interface ListBoxComponent extends Component, ListBoxProperties {
		selectedRow?: number;
		values: string[];
		onRowSelected: vscode.Event<any>;
	}

	export interface TableComponent extends Component, TableComponentProperties {
		onRowSelected: vscode.Event<any>;
	}

	export interface WebViewComponent extends Component {
		html: string;
		message: any;
		onMessage: vscode.Event<any>;
	}

	export interface ButtonComponent extends Component {
		label: string;
		iconPath: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri };
		onDidClick: vscode.Event<any>;
	}

	export interface DashboardWidgetComponent extends Component {
		widgetId: string;
	}

	export interface DashboardWebviewComponent extends Component {
		webviewId: string;
	}

	/**
	 * Component used to wrap another component that needs to be loaded, and show a loading spinner
	 * while the contained component is loading
	 */
	export interface LoadingComponent extends Component {
		/**
		 * Whether to show the loading spinner instead of the contained component. True by default
		 */
		loading: boolean;

		/**
		 * The component displayed when the loading property is false
		 */
		component: Component;
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

			/**
			 * Create a wizard page with the given title, for inclusion in a wizard
			 * @param title The title of the page
			 */
			export function createWizardPage(title: string): WizardPage;

			/**
			 * Create a wizard with the given title and pages
			 * @param title The title of the wizard
			 */
			export function createWizard(title: string): Wizard;

			/**
			 * Used to control whether a message in a dialog/wizard is displayed as an error,
			 * warning, or informational message. Default is error.
			 */
			export enum MessageLevel {
				Error = 0,
				Warning = 1,
				Information = 2
			}

			/**
			 * A message shown in a dialog. If the level is not set it defaults to error.
			 */
			export type DialogMessage = {
				readonly text: string,
				readonly level?: MessageLevel
			};

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

				/**
				 * Whether the panel's content is valid
				 */
				readonly valid: boolean;

				/**
				 * Fired whenever the panel's valid property changes
				 */
				readonly onValidityChanged: vscode.Event<boolean>;
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
				 * Set the informational message shown in the dialog. Hidden when the message is
				 * undefined or the text is empty or undefined. The default level is error.
				 */
				message: DialogMessage;
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

			export interface WizardPageChangeInfo {
				/**
				 * The page number that the wizard changed from
				 */
				lastPage: number,

				/**
				 * The new page number or undefined if the user is closing the wizard
				 */
				newPage: number
			}

			export interface WizardPage extends ModelViewPanel {
				/**
				 * The title of the page
				 */
				title: string;

				/**
				 * A string giving the ID of the page's model view content
				 */
				content: string;

				/**
				 * Any additional buttons that should be displayed while the page is open
				 */
				customButtons: Button[];

				/**
				 * Whether the page is enabled. If the page is not enabled, the user will not be
				 * able to advance to it. Defaults to true.
				 */
				enabled: boolean;
			}

			export interface Wizard {
				/**
				 * The title of the wizard
				 */
				title: string,

				/**
				 * The wizard's pages. Pages can be added/removed while the dialog is open by using
				 * the addPage and removePage methods
				 */
				pages: WizardPage[];

				/**
				 * The index in the pages array of the active page, or undefined if the wizard is
				 * not currently visible
				 */
				readonly currentPage: number;

				/**
				 * The done button
				 */
				doneButton: Button;

				/**
				 * The cancel button
				 */
				cancelButton: Button;

				/**
				 * The generate script button
				 */
				generateScriptButton: Button;

				/**
				 * The next button
				 */
				nextButton: Button;

				/**
				 * The back button
				 */
				backButton: Button;

				/**
				 * Any additional buttons that should be displayed for all pages of the dialog. If
				 * buttons are needed for specific pages they can be added using the customButtons
				 * property on each page.
				 */
				customButtons: Button[];

				/**
				 * Event fired when the wizard's page changes, containing information about the
				 * previous page and the new page
				 */
				onPageChanged: vscode.Event<WizardPageChangeInfo>;

				/**
				 * Add a page to the wizard at the given index
				 * @param page The page to add
				 * @param index The index in the pages array to add the page at, or undefined to
				 * add it at the end
				 */
				addPage(page: WizardPage, index?: number): Thenable<void>;

				/**
				 * Remove the page at the given index from the wizard
				 * @param index The index in the pages array to remove
				 */
				removePage(index: number): Thenable<void>;

				/**
				 * Go to the page at the given index in the pages array.
				 * @param index The index of the page to go to
				 */
				setCurrentPage(index: number): Thenable<void>;

				/**
				 * Open the wizard. Does nothing if the wizard is already open.
				 */
				open(): Thenable<void>;

				/**
				 * Close the wizard. Does nothing if the wizard is not open.
				 */
				close(): Thenable<void>;

				/**
				 * Register a callback that will be called when the user tries to navigate by
				 * changing pages or clicking done. Only one callback can be registered at once, so
				 * each registration call will clear the previous registration.
				 * @param validator The callback that gets executed when the user tries to
				 * navigate. Return true to allow the navigation to proceed, or false to
				 * cancel it.
				 */
				registerNavigationValidator(validator: (pageChangeInfo: WizardPageChangeInfo) => boolean | Thenable<boolean>): void;

				/**
				 * Set the informational message shown in the wizard. Hidden when the message is
				 * undefined or the text is empty or undefined. The default level is error.
				 */
				message: DialogMessage
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
		export function createModelViewEditor(title: string, options?: ModelViewEditorOptions): ModelViewEditor;

		export interface ModelViewEditor extends window.modelviewdialog.ModelViewPanel {

			/**
			 * Opens the editor
			 */
			openEditor(position?: vscode.ViewColumn): Thenable<void>;
		}
	}

	export interface ModelViewEditorOptions {
		/**
		 * Should the model view editor's context be kept around even when the editor is no longer visible? It is false by default
		 */
		readonly retainContextWhenHidden?: boolean;
	}

	export enum DataProviderType {
		ConnectionProvider = 'ConnectionProvider',
		BackupProvider = 'BackupProvider',
		RestoreProvider = 'RestoreProvider',
		ScriptingProvider = 'ScriptingProvider',
		ObjectExplorerProvider = 'ObjectExplorerProvider',
		TaskServicesProvider = 'TaskServicesProvider',
		FileBrowserProvider = 'FileBrowserProvider',
		ProfilerProvider = 'ProfilerProvider',
		MetadataProvider = 'MetadataProvider',
		QueryProvider = 'QueryProvider',
		AdminServicesProvider = 'AdminServicesProvider',
		AgentServicesProvider = 'AgentServicesProvider',
		CapabilitiesProvider = 'CapabilitiesProvider'
	}

	export namespace dataprotocol {
		/**
		 * Get the provider corresponding to the given provider ID and type
		 * @param providerId The ID that the provider was registered with
		 * @param providerType The type of the provider
		 */
		export function getProvider<T extends DataProvider>(providerId: string, providerType: DataProviderType): T;

		/**
		 * Get all registered providers of the given type
		 * @param providerType The type of the providers
		 */
		export function getProvidersByType<T extends DataProvider>(providerType: DataProviderType): T[];
	}
}
