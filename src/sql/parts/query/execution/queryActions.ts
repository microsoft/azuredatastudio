/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryActions';

import * as nls from 'vs/nls';
import { Builder, $ } from 'vs/base/browser/builder';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import Severity from 'vs/base/common/severity';

import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { Action, IActionItem, IActionRunner } from 'vs/base/common/actions';
import { attachEditableDropdownStyler, attachSelectBoxStyler } from 'sql/common/theme/styler';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { IRange } from 'vs/editor/common/core/range';

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
	protected connectEditor(input: QueryInput, runQueryOnCompletion?: RunQueryOnConnectionMode, range?: IRange): void {
		let params: INewConnectionParams = {
			input: input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion || RunQueryOnConnectionMode.none,
			querySelection: range
		};
		this.connectionManagementService.showConnectionDialog(params);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class RunQueryAction extends Action {
	public static ID = 'runQueryAction';

	public static ExecuteClass = 'start';
	public static ExecuteLabel = nls.localize('runQueryLabel', 'Run');

	public static CancelLabel = nls.localize('cancelQueryLabel', 'Cancel');
	public static CancelClass = 'stop';

	private _executing = false;

	constructor() {
		super(RunQueryAction.ID);
		this.executing = false;
	}

	public get executing(): boolean {
		return this._executing;
	}

	public set executing(value: boolean) {
		// intentionally always updating, since parent class handles skipping if values
		this._executing = value;
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon(): void {
		if (this.executing) {
			// We are connected, so show option to disconnect
			this.label = RunQueryAction.CancelLabel;
			this.class = RunQueryAction.CancelClass;
		} else {
			this.label = RunQueryAction.ExecuteLabel;
			this.class = RunQueryAction.ExecuteClass;
		}
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (this.executing) {
			context.input.cancelQuery();
			return TPromise.as(null);
		} else {
			let range = context.editor.getSelection();
			if (this.isCursorPosition(range)) {
				context.input.runQueryStatement(range);
			} else {
				context.input.runQuery(range);
			}
			return TPromise.as(null);
		}
	}

	private isCursorPosition(selection: IRange) {
		return selection.startLineNumber === selection.endLineNumber
			&& selection.startColumn === selection.endColumn;
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class EstimatedQueryPlanAction extends Action {

	public static EnabledClass = 'estimatedQueryPlan';
	public static ID = 'estimatedQueryPlanAction';
	public static LABEL = nls.localize('estimatedQueryPlan', 'Explain');

	constructor() {
		super(EstimatedQueryPlanAction.ID, EstimatedQueryPlanAction.LABEL, EstimatedQueryPlanAction.EnabledClass);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (!context.editor.getSelection()) {
			context.input.runQuery(context.editor.getSelection(), { displayEstimatedQueryPlan: true });
		}
		return TPromise.as(null);
	}

}

export class ActualQueryPlanAction extends Action {
	public static EnabledClass = 'actualQueryPlan';
	public static ID = 'actualQueryPlanAction';
	public static LABEL = nls.localize('actualQueryPlan', "Actual");

	constructor() {
		super(ActualQueryPlanAction.ID, ActualQueryPlanAction.LABEL, ActualQueryPlanAction.EnabledClass);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		if (!context.editor.getSelection()) {
			context.input.runQuery(context.editor.getSelection(), { displayActualQueryPlan: true });
		}
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

	public static ConnectLabel = nls.localize('connectDatabaseLabel', 'Connect');
	public static DisconnectLabel = nls.localize('disconnectDatabaseLabel', 'Disconnect');

	private _connected: boolean;

	constructor(
		@IConnectionManagementService connectionManagementService: IConnectionManagementService
	) {
		super(connectionManagementService, ToggleConnectDatabaseAction.ID);
		this.connected = false;
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
			this.label = ToggleConnectDatabaseAction.DisconnectLabel;
			this.class = ToggleConnectDatabaseAction.DisconnectClass;
		} else {
			this.label = ToggleConnectDatabaseAction.ConnectLabel;
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

export class ChangeConnectionAction extends QueryTaskbarAction {
	public static ID = 'changeConnection';
	public static LABEL = nls.localize('changeConnection', 'Change Connection');
	public static CLASS = 'changeConnection';

	constructor(@IConnectionManagementService connectionManagementService: IConnectionManagementService) {
		super(connectionManagementService, ChangeConnectionAction.ID, ChangeConnectionAction.LABEL, ChangeConnectionAction.CLASS);
	}

	public run(context: IQueryActionContext): TPromise<void> {
		this.connectEditor(context.input);
		return TPromise.as(null);
	}
}

/**
 * Action class that is tied with ListDatabasesActionItem.
 */
export class ListDatabasesAction extends Action {

	public static ID = 'listDatabaseQueryAction';

	constructor() {
		super(ListDatabasesAction.ID);
	}

	public run(): TPromise<void> {
		return TPromise.as(null);
	}
}

/*
 * Action item that handles the dropdown (combobox) that lists the available databases.
 * Based off StartDebugActionItem.
 */
export class ListDatabasesActionItem extends Disposable implements IActionItem {
	public actionRunner: IActionRunner;
	private _context: IQueryActionContext;
	private _currentDatabaseName: string;
	private _isConnected: boolean;
	private $databaseListDropdown: Builder;
	private _dropdown: Dropdown;
	private _databaseSelectBox: SelectBox;
	private _isInAccessibilityMode: boolean;
	private readonly _selectDatabaseString: string = nls.localize("selectDatabase", "Select Database");
	private _enabled = true;

	// CONSTRUCTOR /////////////////////////////////////////////////////////
	constructor(
		@IContextViewService contextViewProvider: IContextViewService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@INotificationService private _notificationService: INotificationService
	) {
		super();
		this.$databaseListDropdown = $('.databaseListDropdown');
		this._isInAccessibilityMode = this._configurationService.getValue('editor.accessibilitySupport') === 'on';

		if (this._isInAccessibilityMode) {
			this._databaseSelectBox = new SelectBox([this._selectDatabaseString], this._selectDatabaseString, contextViewProvider, undefined, { ariaLabel: this._selectDatabaseString });
			this._databaseSelectBox.render(this.$databaseListDropdown.getHTMLElement());
			this._databaseSelectBox.onDidSelect(e => { this.databaseSelected(e.selected); });
			this._databaseSelectBox.disable();

		} else {
			this._dropdown = new Dropdown(this.$databaseListDropdown.getHTMLElement(), contextViewProvider, {
				strictSelection: true,
				placeholder: this._selectDatabaseString,
				ariaLabel: this._selectDatabaseString,
				actionLabel: nls.localize('listDatabases.toggleDatabaseNameDropdown', 'Select Database Toggle Dropdown')
			});
			this._dropdown.onValueChange(s => this.databaseSelected(s));
			this._register(this._dropdown.onFocus(() => { this.onDropdownFocus(); }));
			this._register(attachEditableDropdownStyler(this._dropdown, themeService));
		}

		// Register event handlers
		this._register(this._connectionManagementService.onConnectionChanged(params => { this.onConnectionChanged(params); }));
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

	// EVENT HANDLERS FROM EDITOR //////////////////////////////////////////
	public onConnected(): void {
		let dbName = this.getCurrentDatabaseName();
		this.updateConnection(dbName);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(val: boolean) {
		if (val !== this._enabled) {
			this._enabled = val;
			if (this.enabled) {
				let dbName = this.getCurrentDatabaseName();
				this.updateConnection(dbName);
			} else {
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
		}
	}

	// PRIVATE HELPERS /////////////////////////////////////////////////////
	private databaseSelected(dbName: string): void {
		let uri = this._context.input.uri;
		if (!uri) {
			return;
		}

		let profile = this._connectionManagementService.getConnectionProfile(uri);
		if (!profile) {
			return;
		}

		this._connectionManagementService.changeDatabase(uri, dbName)
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
		let uri = this._context.input.uri;
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

		let uri = this._context.input.uri;
		if (uri !== connParams.connectionUri) {
			return;
		}

		this.updateConnection(connParams.connectionProfile.databaseName);
	}

	private onDropdownFocus(): void {
		let uri = this._context.input.uri;
		if (!uri) {
			return;
		}

		this._connectionManagementService.listDatabases(uri)
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
			let uri = this._context.input.uri;
			if (!uri) {
				return;
			}
			this._connectionManagementService.listDatabases(uri)
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
