/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryActions';
import * as nls from 'vs/nls';
import { Action, IActionRunner } from 'vs/base/common/actions';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { append, $ } from 'vs/base/browser/dom';

import { QueryExecutionOptions } from 'azdata';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode,
	IConnectionCompletionOptions,
	IConnectableInput
} from 'sql/platform/connection/common/connectionManagement';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { attachEditableDropdownStyler } from 'sql/platform/theme/common/styler';
import { Dropdown } from 'sql/base/parts/editableDropdown/browser/dropdown';
import { Task } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { OEAction } from 'sql/workbench/services/objectExplorer/browser/objectExplorerActions';
import { TreeViewItemHandleArg } from 'sql/workbench/common/views';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';
import { ILogService } from 'vs/platform/log/common/log';
import { IRange } from 'vs/editor/common/core/range';
import { getErrorMessage, onUnexpectedError } from 'vs/base/common/errors';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { gen3Version, sqlDataWarehouse } from 'sql/platform/connection/common/constants';

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryTaskbarAction extends Action {

	private _classes: string[];

	constructor(
		protected readonly connectionManagementService: IConnectionManagementService,
		protected readonly editor: QueryEditor,
		id: string,
		enabledClass: string
	) {
		super(id);
		this.enabled = true;
		this._setCssClass(enabledClass);
	}

	protected updateCssClass(enabledClass: string): void {
		// set the class, useful on change of label or icon
		this._setCssClass(enabledClass);
	}

	/**
	 * Sets the CSS classes combining the parent and child classes.
	 * Public for testing only.
	 */
	private _setCssClass(enabledClass: string): void {
		this._classes = [];

		if (enabledClass) {
			this._classes.push(enabledClass);
		}
		this.class = this._classes.join(' ');
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	public isConnected(editor: QueryEditor): boolean {
		if (!editor || !editor.input) {
			return false;
		}
		return this.connectionManagementService.isConnected(editor.input.uri);
	}

	/**
	 * Connects the given editor to it's current URI.
	 * Public for testing only.
	 */
	protected connectEditor(editor: QueryEditor, runQueryOnCompletion?: RunQueryOnConnectionMode, range?: IRange): void {
		let params: INewConnectionParams = {
			input: editor.input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion ? runQueryOnCompletion : RunQueryOnConnectionMode.none,
			queryRange: range
		};
		this.connectionManagementService.showConnectionDialog(params);
	}
}

export function openNewQuery(accessor: ServicesAccessor, profile?: IConnectionProfile, initalContent?: string, onConnection?: RunQueryOnConnectionMode): Promise<void> {
	const editorService = accessor.get(IEditorService);
	const queryEditorService = accessor.get(IQueryEditorService);
	const objectExplorerService = accessor.get(IObjectExplorerService);
	const connectionManagementService = accessor.get(IConnectionManagementService);
	if (!profile) {
		profile = getCurrentGlobalConnection(objectExplorerService, connectionManagementService, editorService);
	}
	return queryEditorService.newSqlEditor({ initalContent }, profile?.providerName).then((owner: IConnectableInput) => {
		// Connect our editor to the input connection
		let options: IConnectionCompletionOptions = {
			params: { connectionType: ConnectionType.editor, runQueryOnCompletion: onConnection, input: owner },
			saveTheConnection: false,
			showDashboard: false,
			showConnectionDialogOnError: true,
			showFirewallRuleOnError: true
		};
		if (profile) {
			return connectionManagementService.connect(profile, owner.uri, options).then();
		}
		return undefined;
	});
}

// --- actions
export class NewQueryTask extends Task {
	public static ID = 'newQuery';
	public static LABEL = nls.localize('newQueryTask.newQuery', "New Query");
	public static ICON = 'new-query';

	constructor() {
		super({
			id: NewQueryTask.ID,
			title: NewQueryTask.LABEL,
			iconPath: undefined,
			iconClass: NewQueryTask.ICON
		});
	}

	public runTask(accessor: ServicesAccessor, profile: IConnectionProfile): Promise<void> {
		return openNewQuery(accessor, profile);
	}
}

export const OE_NEW_QUERY_ACTION_ID = 'objectExplorer.newQuery';

CommandsRegistry.registerCommand(OE_NEW_QUERY_ACTION_ID, (accessor: ServicesAccessor, actionContext: any) => {
	const instantiationService = accessor.get(IInstantiationService);
	return instantiationService.createInstance(OEAction, NewQueryTask.ID, NewQueryTask.LABEL).run(actionContext);
});

export const DE_NEW_QUERY_COMMAND_ID = 'dataExplorer.newQuery';

// New Query
CommandsRegistry.registerCommand({
	id: DE_NEW_QUERY_COMMAND_ID,
	handler: async (accessor, args: TreeViewItemHandleArg) => {
		if (args.$treeItem) {
			const queryEditorService = accessor.get(IQueryEditorService);
			const connectionService = accessor.get(IConnectionManagementService);
			const capabilitiesService = accessor.get(ICapabilitiesService);
			const owner = await queryEditorService.newSqlEditor();
			// Connect our editor to the input connection
			let options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, input: owner },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			return connectionService.connect(new ConnectionProfile(capabilitiesService, args.$treeItem.payload), owner.uri, options);
		}
		return true;
	}
});

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'start';
	public static ID = 'runQueryAction';

	constructor(
		editor: QueryEditor,
		@IQueryModelService protected readonly queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@ICommandService private readonly commandService?: ICommandService
	) {
		super(connectionManagementService, editor, RunQueryAction.ID, RunQueryAction.EnabledClass);
		this.label = nls.localize('runQueryLabel', "Run");
	}

	public override async run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			const runQueryResult = await this.runQuery(this.editor);
			if (!runQueryResult) {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeQuery, this.editor.getSelection());
			}
		}
		return;
	}

	public async runCurrent(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			const runQueryResult = await this.runQuery(this.editor, true);
			if (!runQueryResult) {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeCurrentQuery, this.editor.getSelection(false));
			}
		}
		return;
	}

	private async runQuery(editor: QueryEditor, runCurrentStatement: boolean = false): Promise<boolean> {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			// Hide IntelliSense suggestions list when running query to match SSMS behavior
			this.commandService?.executeCommand('hideSuggestWidget');
			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			let selection = editor.getSelection(false);
			if (runCurrentStatement && selection && this.isCursorPosition(selection)) {
				editor.input.runQueryStatement(selection);
			} else {
				// get the selection again this time with trimming
				selection = editor.getSelection();
				editor.input.runQuery(selection);
			}
			return true;
		}
		return false;
	}

	protected isCursorPosition(selection: IRange) {
		return selection.startLineNumber === selection.endLineNumber
			&& selection.startColumn === selection.endColumn;
	}
}

/**
 * Action class that cancels the running query in the current SQL text document.
 */
export class CancelQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'stop';
	public static ID = 'cancelQueryAction';

	constructor(
		editor: QueryEditor,
		@IQueryModelService private readonly queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@ILogService private readonly logService: ILogService
	) {
		super(connectionManagementService, editor, CancelQueryAction.ID, CancelQueryAction.EnabledClass);
		this.enabled = false;
		this.label = nls.localize('cancelQueryLabel', "Cancel");
	}

	public override async run(): Promise<void> {
		if (this.isConnected(this.editor)) {
			if (!this.editor.input) {
				this.logService.error('editor input was null');
				return;
			}
			this.queryModelService.cancelQuery(this.editor.input.uri);
		}
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class EstimatedQueryPlanAction extends QueryTaskbarAction {

	public static EnabledClass = 'estimatedQueryPlan';
	public static ID = 'estimatedQueryPlanAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, EstimatedQueryPlanAction.ID, EstimatedQueryPlanAction.EnabledClass);
		this.label = nls.localize('estimatedQueryPlan', "Explain");
	}

	public override async run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.estimatedQueryPlan, this.editor.getSelection());
			}
		}
		return;
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			editor.input.runQuery(editor.getSelection(), {
				displayEstimatedQueryPlan: true
			});
		}
	}
}

export class ActualQueryPlanAction extends QueryTaskbarAction {
	public static EnabledClass = 'actualQueryPlan';
	public static ID = 'actualQueryPlanAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ActualQueryPlanAction.ID, ActualQueryPlanAction.EnabledClass);
		this.label = nls.localize('actualQueryPlan', "Actual");
	}

	public override async run(): Promise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.actualQueryPlan, this.editor.getSelection());
			}
		}
		return;
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			let selection = editor.getSelection();
			if (!selection) {
				selection = editor.getAllSelection();
			}
			editor.input.runQuery(selection, {
				displayActualQueryPlan: true
			});
		}
	}
}

/**
 * Action class that disconnects the connection associated with the current query file.
 */
export class DisconnectDatabaseAction extends QueryTaskbarAction {

	public static EnabledClass = 'disconnect';
	public static ID = 'disconnectDatabaseAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, DisconnectDatabaseAction.ID, DisconnectDatabaseAction.EnabledClass);
		this.label = nls.localize('disconnectDatabaseLabel', "Disconnect");
	}

	public override async run(): Promise<void> {
		// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
		// determine if we need to disconnect, cancel an in-progress conneciton, or do nothing
		this.connectionManagementService.disconnectEditor(this.editor.input);
		return;
	}
}

/**
 * Action class that launches a connection dialogue for the current query file
 */
export class ConnectDatabaseAction extends QueryTaskbarAction {

	public static EnabledDefaultClass = 'connect';
	public static EnabledChangeClass = 'changeConnection';
	public static ID = 'connectDatabaseAction';

	constructor(
		editor: QueryEditor,
		isChangeConnectionAction: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		let label: string;
		let enabledClass: string;

		if (isChangeConnectionAction) {
			enabledClass = ConnectDatabaseAction.EnabledChangeClass;
			label = nls.localize('changeConnectionDatabaseLabel', "Change Connection");
		} else {
			enabledClass = ConnectDatabaseAction.EnabledDefaultClass;
			label = nls.localize('connectDatabaseLabel', "Connect");
		}

		super(connectionManagementService, editor, ConnectDatabaseAction.ID, enabledClass);

		this.label = label;
	}

	public override async run(): Promise<void> {
		this.connectEditor(this.editor);
		return;
	}
}

/**
 * Action class that either launches a connection dialogue for the current query file,
 * or disconnects the active connection
 */
export class ToggleConnectDatabaseAction extends QueryTaskbarAction {

	public static ConnectClass = 'connect';
	public static DisconnectClass = 'disconnect';
	public static ID = 'toggleConnectDatabaseAction';

	private _connectLabel = nls.localize('connectDatabaseLabel', "Connect");
	private _disconnectLabel = nls.localize('disconnectDatabaseLabel', "Disconnect");
	constructor(
		editor: QueryEditor,
		private _connected: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ToggleConnectDatabaseAction.ID, undefined);
	}

	public get connected(): boolean {
		return this._connected;
	}

	public set connected(value: boolean) {
		// intentionally always updating, since parent class handles skipping if values
		this._connected = value;
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon(): void {
		if (this._connected) {
			// We are connected, so show option to disconnect
			this.label = this._disconnectLabel;
			this.updateCssClass(ToggleConnectDatabaseAction.DisconnectClass);
		} else {
			this.label = this._connectLabel;
			this.updateCssClass(ToggleConnectDatabaseAction.ConnectClass);
		}
	}


	public override async run(): Promise<void> {
		if (!this.editor.input.isSharedSession) {
			if (this.connected) {
				// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
				// determine if we need to disconnect, cancel an in-progress connection, or do nothing
				this.connectionManagementService.disconnectEditor(this.editor.input);
			} else {
				this.connectEditor(this.editor);
			}
		}
		return;
	}
}

/**
 * Action class that is tied with ListDatabasesActionItem.
 */
export class ListDatabasesAction extends QueryTaskbarAction {

	public static EnabledClass = '';
	public static ID = 'listDatabaseQueryAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ListDatabasesAction.ID, undefined);
		this.enabled = false;
		this.class = ListDatabasesAction.EnabledClass;
	}

	public override async run(): Promise<void> {
		return;
	}
}

/**
 * Action class that toggles SQLCMD mode for the editor
 */
export class ToggleSqlCmdModeAction extends QueryTaskbarAction {

	public static EnableSqlcmdClass = 'enablesqlcmd';
	public static DisableSqlcmdClass = 'disablesqlcmd';
	public static ID = 'ToggleSqlCmdModeAction';

	private _enablesqlcmdLabel = nls.localize('enablesqlcmdLabel', "Enable SQLCMD");
	private _disablesqlcmdLabel = nls.localize('disablesqlcmdLabel', "Disable SQLCMD");
	constructor(
		editor: QueryEditor,
		private _isSqlCmdMode: boolean,
		@IQueryManagementService protected readonly queryManagementService: IQueryManagementService,
		@IConfigurationService protected readonly configurationService: IConfigurationService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@ILogService private readonly logService: ILogService
	) {
		super(connectionManagementService, editor, ToggleSqlCmdModeAction.ID, undefined);
	}

	public get isSqlCmdMode(): boolean {
		return this._isSqlCmdMode;
	}

	public set isSqlCmdMode(value: boolean) {
		this._isSqlCmdMode = value;
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon(): void {
		// show option to disable sql cmd mode if already enabled
		this.label = this.isSqlCmdMode ? this._disablesqlcmdLabel : this._enablesqlcmdLabel;
		this.isSqlCmdMode ? this.updateCssClass(ToggleSqlCmdModeAction.DisableSqlcmdClass) : this.updateCssClass(ToggleSqlCmdModeAction.EnableSqlcmdClass);
	}

	public override async run(): Promise<void> {
		const toSqlCmdState = !this.isSqlCmdMode; // input.state change triggers event that changes this.isSqlCmdMode, so store it before using
		this.editor.input.state.isSqlCmdMode = toSqlCmdState;

		// set query options
		let queryoptions: QueryExecutionOptions = { options: {} };
		queryoptions.options['isSqlCmdMode'] = toSqlCmdState;
		if (!this.editor.input) {
			this.logService.error('editor input was null');
			return;
		}
		this.queryManagementService.setQueryExecutionOptions(this.editor.input.uri, queryoptions);

		// set intellisense options
		toSqlCmdState ? this.connectionManagementService.doChangeLanguageFlavor(this.editor.input.uri, 'sqlcmd', 'MSSQL') : this.connectionManagementService.doChangeLanguageFlavor(this.editor.input.uri, 'sql', 'MSSQL');
	}
}

/*
 * Action item that handles the dropdown (combobox) that lists the available databases.
 * Based off StartDebugActionItem.
 */
export class ListDatabasesActionItem extends Disposable implements IActionViewItem {
	public static ID = 'listDatabaseQueryActionItem';

	public actionRunner: IActionRunner;
	private _currentDatabaseName: string;
	private _isConnected: boolean;
	private _databaseListDropdown: HTMLElement;
	private _dropdown: Dropdown;
	private readonly _selectDatabaseString: string = nls.localize("selectDatabase", "Select Database");

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _editor: QueryEditor,
		@IContextViewService contextViewProvider: IContextViewService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this._databaseListDropdown = $('.databaseListDropdown');
		this._dropdown = new Dropdown(this._databaseListDropdown, contextViewProvider, {
			strictSelection: true,
			placeholder: this._selectDatabaseString,
			ariaLabel: this._selectDatabaseString
		});

		// Allows database selector to commit typed or pasted DB names without the need to click
		// or press enter to make a selection when focus is moved away from the selector.
		this._register(this._dropdown.onBlur(() => this.databaseSelected(this._dropdown.value)));
		this._register(this._dropdown.onValueChange(s => this.databaseSelected(s)));
		this._register(this._dropdown.onFocus(() => this.onDropdownFocus()));
		this._register(this.connectionManagementService.onConnectionChanged(params => this.onConnectionChanged(params)));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public render(container: HTMLElement): void {
		append(container, this._databaseListDropdown);
	}

	public style(styles) {
		this._dropdown.style(styles);
	}

	public setActionContext(context: any): void {
	}

	public isEnabled(): boolean {
		return !!this._isConnected;
	}

	public focus(): void {
		this._dropdown.focus();
	}

	public blur(): void {
		this._dropdown.blur();
	}

	public attachStyler(themeService: IThemeService): IDisposable {
		return attachEditableDropdownStyler(this, themeService);
	}

	// EVENT HANDLERS FROM EDITOR //////////////////////////////////////////
	public onConnected(): void {
		let dbName = this.getCurrentDatabaseName();
		this.updateConnection(dbName);
	}

	public onDisconnect(): void {
		this._isConnected = false;
		this._currentDatabaseName = undefined;

		this._dropdown.enabled = false;
		this._dropdown.value = '';
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private databaseSelected(dbName: string): void {
		// If dbName is blank (this can happen for example when setting the box value to empty when disconnecting)
		// then just no-op, there's nothing we can do.
		if (!dbName) {
			return;
		}

		if (dbName === this.getCurrentDatabaseName()) {
			return;
		}

		if (!this._editor.input) {
			this.logService.error('editor input was null');
			return;
		}

		let uri = this._editor.input.uri;
		if (!uri) {
			return;
		}

		let profile = this.connectionManagementService.getConnectionProfile(uri);
		if (!profile) {
			return;
		}

		this.connectionManagementService.changeDatabase(this._editor.input.uri, dbName)
			.then(
				result => {
					if (!result) {
						this.resetDatabaseName();
						this.notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('changeDatabase.failed', "Failed to change database")
						});
					}
				},
				error => {
					this.resetDatabaseName();
					this.notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('changeDatabase.failedWithError', "Failed to change database: {0}", getErrorMessage(error))
					});
				});
	}

	/**
	 *
	 * @param id profile id
	 * @returns boolean saying if the server connection is a Gen 3 DW server
	 */
	private isDWGen3Database(id: string): boolean {
		const serverInfo = this.connectionManagementService.getServerInfo(id);
		if (serverInfo) {
			return serverInfo.serverEdition === sqlDataWarehouse &&
				serverInfo.serverMajorVersion === gen3Version;
		}
		return false;
	}

	/**
	 *
	 * @param dbName database name
	 * @returns updated database name after stripping the pool name, if any
	 */
	private removePoolInstanceName(dbName: string): string {
		if (dbName.includes('@')) {
			const lastIndex = dbName.lastIndexOf('@');
			dbName = dbName.slice(0, lastIndex);
		}
		return dbName;
	}

	private getCurrentDatabaseName(): string | undefined {
		if (!this._editor.input) {
			this.logService.error('editor input was null');
			return undefined;
		}

		let uri = this._editor.input.uri;
		if (uri) {
			let profile = this.connectionManagementService.getConnectionProfile(uri);
			if (profile) {
				if (this.isDWGen3Database(profile.id)) {
					return this.removePoolInstanceName(profile.databaseName);
				}
				return profile.databaseName;
			}
		}
		return undefined;
	}

	private resetDatabaseName() {
		this._dropdown.value = this.getCurrentDatabaseName();
	}

	private onConnectionChanged(connParams: IConnectionParams): void {
		if (!connParams) {
			return;
		}

		if (!this._editor.input) {
			this.logService.error('editor input was null');
			return;
		}

		let uri = this._editor.input.uri;
		if (uri !== connParams.connectionUri) {
			return;
		}

		this.updateConnection(connParams.connectionProfile.databaseName);
	}

	private onDropdownFocus(): void {
		this.getDatabaseNames().then(databaseNames => {
			this._dropdown.values = databaseNames;
		}).catch(onUnexpectedError);
	}

	/**
	 * Fetches the list of database names from the current editor connection
	 * @returns The list of database names
	 */
	private async getDatabaseNames(): Promise<string[]> {
		if (!this._editor.input) {
			this.logService.error('editor input was null');
			return [];
		}

		let uri = this._editor.input.uri;
		if (!uri) {
			return [];
		}
		try {
			const result = await this.connectionManagementService.listDatabases(uri);
			return result.databaseNames;
		} catch (err) {
			this.logService.error(`Error loading database names for query editor `, err);
		}
		return [];
	}

	private updateConnection(databaseName: string): void {
		// Ignore if the database name is not provided, this happens when the query editor connection is changed to
		// a provider that does not support database.
		if (!databaseName) {
			return;
		}
		this._isConnected = true;
		this._currentDatabaseName = databaseName;
		// Set the value immediately to the initial database so the user can see that, and then
		// populate the list with just that value to avoid displaying an error while we load
		// the full list of databases
		this._dropdown.value = databaseName;
		this._dropdown.values = [databaseName];
		this._dropdown.enabled = true;
		this.getDatabaseNames().then(databaseNames => {
			this._dropdown.values = databaseNames;
		}).catch(onUnexpectedError);
	}

	// TESTING PROPERTIES //////////////////////////////////////////////////
	public get currentDatabaseName(): string {
		return this._currentDatabaseName;
	}

}

/**
 * Action class that sends the request to convert the contents of the sql editor
 * into a Notebook document
 */
export class ExportAsNotebookAction extends QueryTaskbarAction {

	public static IconClass = 'export';
	public static ID = 'exportAsNotebookAction';

	constructor(
		editor: QueryEditor,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@ICommandService private _commandService: ICommandService
	) {
		super(connectionManagementService, editor, ConnectDatabaseAction.ID, ExportAsNotebookAction.IconClass);

		this.label = nls.localize('queryEditor.exportSqlAsNotebook', "Export as Notebook");
	}

	public override async run(): Promise<void> {
		this._commandService.executeCommand('mssql.exportSqlAsNotebook', this.editor.input.uri);
	}
}
