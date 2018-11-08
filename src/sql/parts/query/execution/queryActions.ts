/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryActions';

import * as nls from 'vs/nls';
import { Builder, $ } from 'vs/base/browser/builder';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import Severity from 'vs/base/common/severity';

import * as sqlops from 'sqlops';

import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { Action, IActionItem, IActionRunner } from 'vs/base/common/actions';
import { EventEmitter } from 'sql/base/common/eventEmitter';
import { attachEditableDropdownStyler, attachSelectBoxStyler } from 'sql/common/theme/styler';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { QueryEditor } from 'sql/parts/query/editor/queryEditor';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { QueryInput } from 'sql/parts/query/common/queryInput';

export interface IQueryActionContext {
	input: QueryInput;
	editor: ICodeEditor;
}

/**
 * Action class that query-based Actions will extend. This base class automatically handles activating and
 * deactivating the button when a SQL file is opened.
 */
export abstract class QueryTaskbarAction extends Action {

	constructor(
		protected connectionManagementService: IConnectionManagementService,
		id: string,
		label?: string,
		cssClass?: string
	) {
		super(id, label, cssClass);
	}

	/**
	 * This method is executed when the button is clicked.
	 */
	public abstract run(context: IQueryActionContext): TPromise<void>;

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	public isConnected(input: QueryInput): boolean {
		if (!input) {
			return false;
		}
		return this.connectionManagementService.isConnected(input.uri);
	}

	/**
	 * Connects the given editor to it's current URI.
	 * Public for testing only.
	 */
	protected connectEditor(input: QueryInput, runQueryOnCompletion?: RunQueryOnConnectionMode, selection?: sqlops.ISelectionData): void {
		let params: INewConnectionParams = {
			input: input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion || RunQueryOnConnectionMode.none,
			querySelection: selection
		};
		this.connectionManagementService.showConnectionDialog(params);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryAction extends QueryTaskbarAction {

	public static EnabledClass = 'start';
	public static ID = 'runQueryAction';
	public static LABEL = nls.localize('runQueryLabel', 'Run');

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, RunQueryAction.ID, RunQueryAction.LABEL, RunQueryAction.EnabledClass);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (!context.editor.getSelection()) {
			let vscodeSelection = context.editor.getSelection();
			let selection: sqlops.ISelectionData = {
				startLine: vscodeSelection.startLineNumber - 1,
				startColumn: vscodeSelection.startColumn - 1,
				endLine: vscodeSelection.endLineNumber - 1,
				endColumn: vscodeSelection.endColumn - 1,
			};
			if (this.isConnected(context.input)) {
				// If we are already connected, run the query
				return TPromise.wrap(this.runQuery(context.input, selection));
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				return TPromise.wrap(this.connectEditor(context.input, RunQueryOnConnectionMode.executeQuery, selection));
			}
		}
		return TPromise.as(null);
	}

	private runQuery(input: QueryInput, selection: sqlops.ISelectionData, runCurrentStatement: boolean = false) {
		if (this.isConnected(input)) {
			// if the selection isn't empty then execute the selection
			// otherwise, either run the statement or the script depending on parameter
			if (runCurrentStatement && this.isCursorPosition(selection)) {
				input.runQueryStatement(selection);
			} else {
				// get the selection again this time with trimming
				input.runQuery(selection);
			}
		}
	}

	private isCursorPosition(selection: sqlops.ISelectionData) {
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
	public static LABEL = nls.localize('cancelQueryLabel', 'Cancel');

	constructor(
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, CancelQueryAction.ID, CancelQueryAction.LABEL, CancelQueryAction.EnabledClass);
		this.enabled = false;
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (this.isConnected(context.input)) {
			this._queryModelService.cancelQuery(context.input.uri);
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
	public static LABEL = nls.localize('estimatedQueryPlan', 'Explain');

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, EstimatedQueryPlanAction.ID, EstimatedQueryPlanAction.LABEL, EstimatedQueryPlanAction.EnabledClass);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (!context.editor.getSelection()) {
			let vscodeSelection = context.editor.getSelection();
			let selection: sqlops.ISelectionData = {
				startLine: vscodeSelection.startLineNumber - 1,
				startColumn: vscodeSelection.startColumn - 1,
				endLine: vscodeSelection.endLineNumber - 1,
				endColumn: vscodeSelection.endColumn - 1,
			};
			if (this.isConnected(context.input)) {
				// If we are already connected, run the query
				return TPromise.wrap(this.runQuery(context.input, selection));
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				return TPromise.wrap(this.connectEditor(context.input, RunQueryOnConnectionMode.executeQuery, selection));
			}
		}
		return TPromise.as(null);
	}

	private runQuery(input: QueryInput, selection: sqlops.ISelectionData) {
		if (this.isConnected(input)) {
			input.runQuery(selection, {
				displayEstimatedQueryPlan: true
			});
		}
	}
}

export class ActualQueryPlanAction extends QueryTaskbarAction {
	public static EnabledClass = 'actualQueryPlan';
	public static ID = 'actualQueryPlanAction';
	public static LABEL = nls.localize('actualQueryPlan', "Actual");

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, ActualQueryPlanAction.ID, ActualQueryPlanAction.LABEL, ActualQueryPlanAction.EnabledClass);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (!context.editor.getSelection()) {
			let vscodeSelection = context.editor.getSelection();
			let selection: sqlops.ISelectionData = {
				startLine: vscodeSelection.startLineNumber - 1,
				startColumn: vscodeSelection.startColumn - 1,
				endLine: vscodeSelection.endLineNumber - 1,
				endColumn: vscodeSelection.endColumn - 1,
			};
			if (this.isConnected(context.input)) {
				// If we are already connected, run the query
				return TPromise.wrap(this.runQuery(context.input, selection));
			} else {
				// If we are not already connected, prompt for connection and run the query if the
				// connection succeeds. "runQueryOnCompletion=true" will cause the query to run after connection
				return TPromise.wrap(this.connectEditor(context.input, RunQueryOnConnectionMode.executeQuery, selection));
			}
		}
		return TPromise.as(null);
	}

	private runQuery(input: QueryInput, selection: sqlops.ISelectionData) {
		if (this.isConnected(input)) {
			input.runQuery(selection, {
				displayActualQueryPlan: true
			});
		}
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

	public static ConnectLabel = nls.localize('connectDatabaseLabel', 'Connect');
	public static DisconnectLabel = nls.localize('disconnectDatabaseLabel', 'Disconnect');

	private _connected: boolean;
	private _connectLabel: string;
	private _disconnectLabel: string;

	constructor(
		isConnected: boolean,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, ToggleConnectDatabaseAction.ID);
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
			this.class = ToggleConnectDatabaseAction.DisconnectClass;
		} else {
			this.label = this._connectLabel;
			this.class = ToggleConnectDatabaseAction.ConnectClass;
		}
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (this.connected) {
			// Call disconnectEditor regardless of the connection state and let the ConnectionManagementService
			// determine if we need to disconnect, cancel an in-progress connection, or do nothing
			this.connectionManagementService.disconnectEditor(context.input);
		} else {
			this.connectEditor(context.input);
		}
		return TPromise.as(null);
	}
}

/**
 * Action class that is tied with ListDatabasesActionItem.
 */
export class ListDatabasesAction extends QueryTaskbarAction {

	public static ID = 'listDatabaseQueryAction';

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, ListDatabasesAction.ID);
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
	private _databaseSelectBox: SelectBox;
	private _isInAccessibilityMode: boolean;
	private readonly _selectDatabaseString: string = nls.localize("selectDatabase", "Select Database");

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		private _editor: QueryEditor,
		private _action: ListDatabasesAction,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@INotificationService private _notificationService: INotificationService,
		@IContextViewService contextViewProvider: IContextViewService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private readonly _configurationService: IConfigurationService
	) {
		super();
		this._toDispose = [];
		this.$databaseListDropdown = $('.databaseListDropdown');
		this._isInAccessibilityMode = this._configurationService.getValue('editor.accessibilitySupport') === 'on';

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox = new SelectBox([this._selectDatabaseString], this._selectDatabaseString, contextViewProvider, undefined, { ariaLabel: this._selectDatabaseString });
			this._databaseSelectBox.render(this.$databaseListDropdown.getHTMLElement());
			this._databaseSelectBox.onDidSelect(e => { this.databaseSelected(e.selected); });
			this._databaseSelectBox.disable();

		} else {
			this._dropdown = new Dropdown(this.$databaseListDropdown.getHTMLElement(), contextViewProvider, themeService, {
				strictSelection: true,
				placeholder: this._selectDatabaseString,
				ariaLabel: this._selectDatabaseString,
				actionLabel: nls.localize('listDatabases.toggleDatabaseNameDropdown', 'Select Database Toggle Dropdown')
			});
			this._dropdown.onValueChange(s => this.databaseSelected(s));
			this._toDispose.push(this._dropdown.onFocus(() => { self.onDropdownFocus(); }));
		}

		// Register event handlers
		let self = this;
		this._toDispose.push(this._connectionManagementService.onConnectionChanged(params => { self.onConnectionChanged(params); }));
	}

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public render(container: HTMLElement): void {
		this.$databaseListDropdown.appendTo(container);
	}

	public style(styles) {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.style(styles);
		}
		else {
			this._dropdown.style(styles);
		}
	}

	public setActionContext(context: any): void {
		this._context = context;
	}

	public isEnabled(): boolean {
		return !!this._isConnected;
	}

	public focus(): void {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.focus();
		} else {
			this._dropdown.focus();
		}
	}

	public blur(): void {
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.blur();
		} else {
			this._dropdown.blur();
		}
	}

	public attachStyler(themeService: IThemeService): IDisposable {
		if (this._isInAccessibilityMode) {
			return attachSelectBoxStyler(this, themeService);
		} else {
			return attachEditableDropdownStyler(this, themeService);
		}
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
		this._currentDatabaseName = undefined;

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.disable();
			this._databaseSelectBox.setOptions([this._selectDatabaseString]);
		} else {
			this._dropdown.enabled = false;
			this._dropdown.value = '';
		}
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
						this._notificationService.notify({
							severity: Severity.Error,
							message: nls.localize('changeDatabase.failed', "Failed to change database")
						});
					}
				},
				error => {
					this.resetDatabaseName();
					this._notificationService.notify({
						severity: Severity.Error,
						message: nls.localize('changeDatabase.failedWithError', "Failed to change database {0}", error)
					});
				});
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
		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.selectWithOptionName(this.getCurrentDatabaseName());
		} else {
			this._dropdown.value = this.getCurrentDatabaseName();
		}
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
		this._currentDatabaseName = databaseName;

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox.enable();
			let self = this;
			let uri = self._editor.connectedUri;
			if (!uri) {
				return;
			}
			self._connectionManagementService.listDatabases(uri)
				.then(result => {
					if (result && result.databaseNames) {
						this._databaseSelectBox.setOptions(result.databaseNames);
					}
					this._databaseSelectBox.selectWithOptionName(databaseName);
				});
		} else {
			this._dropdown.enabled = true;
			this._dropdown.value = databaseName;
		}
	}

	// TESTING PROPERTIES //////////////////////////////////////////////////
	public get currentDatabaseName(): string {
		return this._currentDatabaseName;
	}

}
