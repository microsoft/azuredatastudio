/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/query/common/media/flavorStatus';
import { $, append, show, hide } from 'vs/base/browser/dom';
import { IDisposable, combinedDisposable } from 'vs/base/common/lifecycle';
import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Action } from 'vs/base/common/actions';
import errors = require('vs/base/common/errors');
import { TPromise } from 'vs/base/common/winjs.base';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import nls = require('vs/nls');

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';

import { DidChangeLanguageFlavorParams } from 'sqlops';
import Severity from 'vs/base/common/severity';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';

export interface ISqlProviderEntry extends IQuickPickItem {
	providerId: string;
}

// Query execution status
class SqlProviderEntry implements ISqlProviderEntry {
	constructor(public providerId: string, private _providerDisplayName?: string) {
	}

	public get label(): string {
		// If display name is provided, use it. Else use default
		if (this._providerDisplayName) {
			return this._providerDisplayName;
		}

		if (!this.providerId) {
			return SqlProviderEntry.getDefaultLabel();
		}
		// Note: consider adding API to connection management service to
		// support getting display name for provider so this is consistent
		switch (this.providerId) {
			case 'MSSQL':
				return 'MSSQL';
			default:
				return this.providerId;
		}
	}

	public static getDefaultLabel(): string {
		return nls.localize('chooseSqlLang', 'Choose SQL Language');
	}
}

// Shows SQL flavor status in the editor
export class SqlFlavorStatusbarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _flavorElement: HTMLElement;
	private _sqlStatusEditors: { [editorUri: string]: SqlProviderEntry };
	private _toDispose: IDisposable[];

	constructor(
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IEditorService private _editorService: EditorServiceImpl,
		@IEditorGroupsService private _editorGroupService: IEditorGroupsService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@IInstantiationService private _instantiationService: IInstantiationService,
	) {
		this._sqlStatusEditors = {};
	}

	public render(container: HTMLElement): IDisposable {
		this._element = append(container, $('.query-statusbar-group'));
		this._flavorElement = append(this._element, $('a.editor-status-selection'));
		this._flavorElement.title = nls.localize('changeProvider', "Change SQL language provider");
		this._flavorElement.onclick = () => this._onSelectionClick();
		hide(this._flavorElement);

		this._toDispose = [];
		this._toDispose.push(
			this._connectionManagementService.onLanguageFlavorChanged((changeParams: DidChangeLanguageFlavorParams) => this._onFlavorChanged(changeParams)),
			this._editorService.onDidVisibleEditorsChange(() => this._onEditorsChanged()),
			this._editorService.onDidCloseEditor(event => this._onEditorClosed(event))
		);
		return combinedDisposable(this._toDispose);
	}

	private _onSelectionClick() {
		const action = this._instantiationService.createInstance(ChangeFlavorAction, ChangeFlavorAction.ID, ChangeFlavorAction.LABEL);

		action.run().then(null, errors.onUnexpectedError);
		action.dispose();
	}

	private _onEditorClosed(event: IEditorCloseEvent): void {
		let uri = WorkbenchUtils.getEditorUri(event.editor);
		if (uri && uri in this._sqlStatusEditors) {
			// If active editor is being closed, hide the query status.
			let activeEditor = this._editorService.activeControl;
			if (activeEditor) {
				let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
				if (uri === currentUri) {
					hide(this._flavorElement);
				}
			}
			// note: intentionally not removing language flavor. This is preserved across close/open events at present
			// delete this._sqlStatusEditors[uri];
		}
	}

	private _onEditorsChanged(): void {
		let activeEditor = this._editorService.activeControl;
		if (activeEditor) {
			let uri = WorkbenchUtils.getEditorUri(activeEditor.input);

			// Show active editor's language flavor	status
			if (uri) {
				this._showStatus(uri);
			} else {
				hide(this._flavorElement);
			}
		} else {
			hide(this._flavorElement);
		}
	}

	private _onFlavorChanged(changeParams: DidChangeLanguageFlavorParams): void {
		if (changeParams) {
			this._updateStatus(changeParams.uri, new SqlProviderEntry(changeParams.flavor));
		}
	}

	// Update query status for the editor
	private _updateStatus(uri: string, newStatus: SqlProviderEntry): void {
		if (uri) {
			this._sqlStatusEditors[uri] = newStatus;
			this._showStatus(uri);
		}
	}

	// Show/hide query status for active editor
	private _showStatus(uri: string): void {
		let activeEditor = this._editorService.activeControl;
		if (activeEditor) {
			let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
			if (uri === currentUri) {
				let flavor: SqlProviderEntry = this._sqlStatusEditors[uri];
				if (flavor) {
					this._flavorElement.textContent = flavor.label;
				} else {
					this._flavorElement.textContent = SqlProviderEntry.getDefaultLabel();
				}
				show(this._flavorElement);
			}
		}
	}
}

export class ChangeFlavorAction extends Action {

	public static ID = 'sql.action.editor.changeProvider';
	public static LABEL = nls.localize('changeSqlProvider', "Change SQL Engine Provider");

	constructor(
		actionId: string,
		actionLabel: string,
		@IEditorService private _editorService: IEditorService,
		@IQuickInputService private _quickInputService: IQuickInputService,
		@INotificationService private _notificationService: INotificationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService
	) {
		super(actionId, actionLabel);
	}

	public run(): TPromise<any> {
		let activeEditor = this._editorService.activeControl;
		let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
		if (this._connectionManagementService.isConnected(currentUri)) {
			let currentProvider = this._connectionManagementService.getProviderIdFromUri(currentUri);
			return this._showMessage(Severity.Info, nls.localize('alreadyConnected',
				"A connection using engine {0} exists. To change please disconnect or change connection", currentProvider));
		}
		const editorWidget = getCodeEditor(activeEditor);
		if (!editorWidget) {
			return this._showMessage(Severity.Info, nls.localize('noEditor', "No text editor active at this time"));
		}

		// TODO #1334 use connectionManagementService.GetProviderNames here. The challenge is that the credentials provider is returned
		// so we need a way to filter this using a capabilities check, with isn't yet implemented
		const ProviderOptions: ISqlProviderEntry[] = [
			new SqlProviderEntry('MSSQL')
		];

		// TODO: select the current language flavor
		return this._quickInputService.pick(ProviderOptions, { placeHolder: nls.localize('pickSqlProvider', "Select SQL Language Provider") }).then(provider => {
			if (provider) {
				activeEditor = this._editorService.activeControl;
				const editorWidget = getCodeEditor(activeEditor);
				if (editorWidget) {
					if (currentUri) {
						this._connectionManagementService.doChangeLanguageFlavor(currentUri, 'sql', provider.providerId);
					}
				}
			}
		});
	}

	private _showMessage(sev: Severity, message: string): TPromise<any> {
		this._notificationService.notify({
			severity: sev,
			message: message
		});

		return TPromise.as(undefined);
	}
}
