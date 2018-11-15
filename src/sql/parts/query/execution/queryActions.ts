/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/editor/media/queryActions';

import * as nls from 'vs/nls';
import { Builder, $ } from 'vs/base/browser/builder';
import { Disposable } from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICodeEditor } from 'vs/editor/browser/editorBrowser';
import Severity from 'vs/base/common/severity';
import { Action, IActionItem, IActionRunner } from 'vs/base/common/actions';
import { IRange } from 'vs/editor/common/core/range';
import * as platform from 'vs/base/common/platform';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

import { Dropdown } from 'sql/base/browser/ui/editableDropdown/dropdown';
import { attachEditableDropdownStyler } from 'sql/common/theme/styler';
import {
	IConnectionManagementService,
	IConnectionParams,
	INewConnectionParams,
	ConnectionType,
	RunQueryOnConnectionMode
} from 'sql/parts/connection/common/connectionManagement';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { QueryEditorAction, registerQueryEditorAction } from 'sql/parts/query/editor/queryEditorExtensions';

export interface IQueryActionContext {
	input: QueryInput;
	editor: ICodeEditor;
}

/**
 * Action class that runs a query in the active SQL text document.
 */
const runQueryKb = platform.isWeb
	? KeyMod.CtrlCmd | KeyCode.F5
	: KeyCode.F5;

export class RunQueryAction extends QueryEditorAction {
	public static ID = 'editor.action.runQuery';

	constructor() {
		super({
			id: RunQueryAction.ID,
			label: nls.localize('runQueryLabel', 'Run Query'),
			alias: 'Run Query',
			class: 'start',
			precondition: undefined,
			kbOpts: {
				primary: runQueryKb,
				weight: KeybindingWeight.EditorContrib
			},
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void> {
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		let range = editor.getSelection();
		if (this.isCursorPosition(range)) {
			input.runQueryStatement(range);
		} else {
			input.runQuery(range);
		}
		return TPromise.as(null);
	}

	private isCursorPosition(selection: IRange) {
		return selection.startLineNumber === selection.endLineNumber
			&& selection.startColumn === selection.endColumn;
	}
}

/**
 * Cancel a query if it is actively running
 */
const cancelQueryKb = platform.isWeb
	? KeyMod.CtrlCmd | KeyCode.F5
	: KeyCode.F5;

export class CancelQueryAction extends QueryEditorAction {
	public static ID = 'editor.action.cancelQuery';

	constructor() {
		super({
			id: CancelQueryAction.ID,
			label: nls.localize('cancelQuery', 'Cancel Query'),
			alias: 'Cancel Query',
			class: 'stop',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor): TPromise<void> {
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		input.cancelQuery();
		return TPromise.as(null);
	}
}

/**
 * Action class that runs a query in the active SQL text document.
 */
export class EstimatedQueryPlanAction extends QueryEditorAction {

	public static ID = 'estimatedQueryPlanAction';

	constructor() {
		super({
			id: EstimatedQueryPlanAction.ID,
			label: nls.localize('estimatedQueryPlan', 'Estimated Query Plan'),
			alias: 'Estimated Query Plan',
			class: 'estimatedQueryPlan',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void> {
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		if (!editor.getSelection()) {
			input.runQuery(editor.getSelection(), { displayEstimatedQueryPlan: true });
		}
		return TPromise.as(null);
	}
}

export class ActualQueryPlanAction extends QueryEditorAction {
	public static ID = 'actualQueryPlanAction';

	constructor() {
		super({
			id: EstimatedQueryPlanAction.ID,
			label: nls.localize('actualQueryPlan', 'Actual Query Plan'),
			alias: 'Actual Query Plan',
			class: 'actualQueryPlan',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor, editor: ICodeEditor): TPromise<void> {
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		if (!editor.getSelection()) {
			input.runQuery(editor.getSelection(), { displayActualQueryPlan: true });
		}
		return TPromise.as(null);
	}
}

export class DisconnectAction extends QueryEditorAction {
	public static ID = 'disconnectAction';

	constructor() {
		super({
			id: DisconnectAction.ID,
			label: nls.localize('disconnectLabel', 'Disconnect'),
			alias: 'Disconnect',
			class: 'disconnect',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor): TPromise<void> {
		const cms = accessor.get(IConnectionManagementService);
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		cms.disconnectEditor(input);
		return TPromise.as(null);
	}
}

export class ConnectAction extends QueryEditorAction {
	public static ID = 'connectionAction';

	constructor() {
		super({
			id: ConnectAction.ID,
			label: nls.localize('connectLabel', 'Connect'),
			alias: 'Connect',
			class: 'connect',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor): TPromise<void> {
		const cms = accessor.get(IConnectionManagementService);
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		let params: INewConnectionParams = {
			input: input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: RunQueryOnConnectionMode.none
		};
		cms.showConnectionDialog(params);
		return TPromise.as(null);
	}
}

export class ChangeConnectionAction extends QueryEditorAction {
	public static ID = 'changeConnection';

	constructor() {
		super({
			id: ChangeConnectionAction.ID,
			label: nls.localize('changeConnection', 'Change Connection'),
			alias: 'Change Connection',
			class: 'changeConnection',
			precondition: undefined,
			menuOpts: {
				group: 'query',
				order: 1.1
			}
		});
	}

	public run(accessor: ServicesAccessor): TPromise<void> {
		const cms = accessor.get(IConnectionManagementService);
		const input = accessor.get(IEditorService).activeEditor as QueryInput;
		let params: INewConnectionParams = {
			input: input,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: RunQueryOnConnectionMode.none
		};
		cms.showConnectionDialog(params);
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

registerQueryEditorAction(RunQueryAction);
registerQueryEditorAction(CancelQueryAction);
registerQueryEditorAction(EstimatedQueryPlanAction);
registerQueryEditorAction(ActualQueryPlanAction);
registerQueryEditorAction(DisconnectAction);
registerQueryEditorAction(ConnectAction);
registerQueryEditorAction(ChangeConnectionAction);
