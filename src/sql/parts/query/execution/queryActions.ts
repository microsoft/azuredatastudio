/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Builder, $ } from 'vs/base/browser/builder';
import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { Action, IActionItem, IActionRunner } from 'vs/base/common/actions';
import { EventEmitter } from 'sql/base/common/eventEmitter';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { IThemeService } from 'vs/platform/theme/common/themeService';

import { ISelectionData } from 'sqlops';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryTaskbarAction extends Action {

	private _classes: string[];

	constructor(
		protected _connectionManagementService: IConnectionManagementService,
		protected editor: QueryEditor,
		id: string,
		enabledClass: string
	) {
		super(id);
		this.enabled = true;
		this._setCssClass(enabledClass);
	}

	/**
	 * This method is executed when the button is clicked.
	 */
	public abstract run(): TPromise<void>;

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
		if (!editor || !editor.currentQueryInput) {
			return false;
		}
		return this._connectionManagementService.isConnected(editor.currentQueryInput.uri);
	}

	/**
	 * Connects the given editor to it's current URI.
	 * Public for testing only.
	 */
	protected connectEditor(editor: QueryEditor, runQueryOnCompletion?: RunQueryOnConnectionMode, selection?: ISelectionData): void {
		let params: INewConnectionParams = {
			input: editor.currentQueryInput,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion ? runQueryOnCompletion : RunQueryOnConnectionMode.none,
			querySelection: selection
		};
		this._connectionManagementService.showConnectionDialog(params);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'start';
	public static ID = 'runQueryAction';

	constructor(
		editor: QueryEditor,
		@IQueryModelService protected _queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, RunQueryAction.ID, RunQueryAction.EnabledClass);
		this.label = nls.localize('runQueryLabel', 'Run');
	}

	public run(): TPromise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeQuery, this.editor.getSelection());
			}
		}
		return TPromise.as(null);
	}

	public runCurrent(): TPromise<void> {
		if (!this.editor.isSelectionEmpty()) {
			if (this.isConnected(this.editor)) {
				// If we are already connected, run the query
				this.runQuery(this.editor, true);
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				this.connectEditor(this.editor, RunQueryOnConnectionMode.executeCurrentQuery, this.editor.getSelection(false));
			}
		}
		return TPromise.as(null);
	}

	public runQuery(editor: QueryEditor, runCurrentStatement: boolean = false) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			let selection: ISelectionData = editor.getSelection(false);
			if (runCurrentStatement && selection && this.isCursorPosition(selection)) {
				editor.currentQueryInput.runQueryStatement(selection);
			} else {
				// get the selection again this time with trimming
				selection = editor.getSelection();
				editor.currentQueryInput.runQuery(selection);
			}
		}
	}

	protected isCursorPosition(selection: ISelectionData) {
		return selection.startLine === selection.endLine
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
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, CancelQueryAction.ID, CancelQueryAction.EnabledClass);
		this.enabled = false;
		this.label = nls.localize('cancelQueryLabel', 'Cancel');
	}

	public run(): TPromise<void> {
		if (this.isConnected(this.editor)) {
			this._queryModelService.cancelQuery(this.editor.currentQueryInput.uri);
		}
		return TPromise.as(null);
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
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, EstimatedQueryPlanAction.ID, EstimatedQueryPlanAction.EnabledClass);
		this.label = nls.localize('estimatedQueryPlan', 'Explain');
	}

	public run(): TPromise<void> {
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
		return TPromise.as(null);
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			editor.currentQueryInput.runQuery(editor.getSelection(), {
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
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, editor, ActualQueryPlanAction.ID, ActualQueryPlanAction.EnabledClass);
		this.label = nls.localize('actualQueryPlan', "Actual");
	}

	public run(): TPromise<void> {
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
		return TPromise.as(null);
	}

	public runQuery(editor: QueryEditor) {
		if (!editor) {
			editor = this.editor;
		}

		if (this.isConnected(editor)) {
			editor.currentQueryInput.runQuery(editor.getSelection(), {
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
		this.label = nls.localize('disconnectDatabaseLabel', 'Disconnect');
	}

	public run(): TPromise<void> {
		// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
		// determine if we need to disconnect, cancel an in-progress conneciton, or do nothing
		this._connectionManagementService.disconnectEditor(this.editor.currentQueryInput);
		return TPromise.as(null);
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
			label = nls.localize('changeConnectionDatabaseLabel', 'Change Connection');
		} else {
			enabledClass = ConnectDatabaseAction.EnabledDefaultClass;
			label = nls.localize('connectDatabaseLabel', 'Connect');
		}

		super(connectionManagementService, editor, ConnectDatabaseAction.ID, enabledClass);

		this.label = label;
	}

	public run(): TPromise<void> {
		this.connectEditor(this.editor);
		return TPromise.as(null);
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

	private _connected: boolean;
	private _connectLabel: string;
	private _disconnectLabel: string;
	constructor(
		editor: QueryEditor,
		isConnected: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		let enabledClass: string;

		super(connectionManagementService, editor, ToggleConnectDatabaseAction.ID, enabledClass);

		this._connectLabel = nls.localize('connectDatabaseLabel', 'Connect');
		this._disconnectLabel = nls.localize('disconnectDatabaseLabel', 'Disconnect');

		this.connected = isConnected;
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

	public run(): TPromise<void> {
		if (this.connected) {
			// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
			// determine if we need to disconnect, cancel an in-progress connection, or do nothing
			this._connectionManagementService.disconnectEditor(this.editor.currentQueryInput);
		} else {
			this.connectEditor(this.editor);
		}
		return TPromise.as(null);
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

	public run(): TPromise<void> {
		return TPromise.as(null);
	}
}

/*
 * Action item that handles the dropdown (combobox) that lists the available databases.
 * Based off StartDebugActionItem.
 */
export class ListDatabasesActionItem extends EventEmitter implements IActionItem {
	public static ID = 'listDatabaseQueryActionItem';

	public actionRunner: IActionRunner;
	private _toDispose: IDisposable[];
	private _context: any;
	private _currentDatabaseName: string;
	private _isConnected: boolean;
	private $databaseListDropdown: Builder;
	private _dropdown: Dropdown;

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _editor: QueryEditor,
		private _action: ListDatabasesAction,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IMessageService private _messageService: IMessageService,
		@IContextViewService contextViewProvider: IContextViewService,
		@IThemeService themeService: IThemeService
	) {
		super();
		this._toDispose = [];
		this.$databaseListDropdown = $('.databaseListDropdown');
		this._dropdown = new Dropdown(this.$databaseListDropdown.getHTMLElement(), contextViewProvider, themeService, {
			strictSelection: true,
			placeholder: nls.localize("selectDatabase", "Select Database")
		});
		this._dropdown.onValueChange(s => this.databaseSelected(s));

		// Register event handlers
		let self = this;
		this._toDispose.push(this._dropdown.onFocus(() => { self.onDropdownFocus(); }));
		this._toDispose.push(this._connectionManagementService.onConnectionChanged(params => { self.onConnectionChanged(params); }));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public render(container: HTMLElement): void {
		this.$databaseListDropdown.appendTo(container);
	}

	public style(styles) {
		this._dropdown.style(styles);
	}

	public setActionContext(context: any): void {
		this._context = context;
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

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	// EVENT HANDLERS FROM EDITOR //////////////////////////////////////////
	public onConnected(): void {
		let dbName = this.getCurrentDatabaseName();
		this.updateConnection(dbName);
	}

	public onDisconnect(): void {
		this._isConnected = false;
		this._dropdown.enabled = false;
		this._currentDatabaseName = undefined;
		this._dropdown.value = '';
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private databaseSelected(dbName: string): void {
		let uri = this._editor.connectedUri;
		if (!uri) {
			return;
		}

		let profile = this._connectionManagementService.getConnectionProfile(uri);
		if (!profile) {
			return;
		}

		this._connectionManagementService.changeDatabase(this._editor.uri, dbName)
			.then(
			result => {
				if (!result) {
					this.resetDatabaseName();
					this._messageService.show(Severity.Error, nls.localize('changeDatabase.failed', "Failed to change database"));
				}
			},
			error => {
				this.resetDatabaseName();
				this._messageService.show(Severity.Error, nls.localize('changeDatabase.failedWithError', "Failed to change database {0}", error));
			}
			);
	}

	private getCurrentDatabaseName() {
		let uri = this._editor.connectedUri;
		if (uri) {
			let profile = this._connectionManagementService.getConnectionProfile(uri);
			if (profile) {
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

		let uri = this._editor.connectedUri;
		if (uri !== connParams.connectionUri) {
			return;
		}

		this.updateConnection(connParams.connectionProfile.databaseName);
	}

	private onDropdownFocus(): void {
		let self = this;

		let uri = self._editor.connectedUri;
		if (!uri) {
			return;
		}

		self._connectionManagementService.listDatabases(uri)
			.then(result => {
				if (result && result.databaseNames) {
					this._dropdown.values = result.databaseNames;
				}
			});
	}

	private updateConnection(databaseName: string) {
		this._isConnected = true;
		this._dropdown.enabled = true;
		this._currentDatabaseName = databaseName;
		this._dropdown.value = databaseName;
	}

	// TESTING PROPERTIES //////////////////////////////////////////////////
	public get currentDatabaseName(): string {
		return this._currentDatabaseName;
	}

}
