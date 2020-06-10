/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/flavorStatus';
import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { Action } from 'vs/base/common/actions';
import { getCodeEditor } from 'vs/editor/browser/editorBrowser';
import * as nls from 'vs/nls';

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { DidChangeLanguageFlavorParams } from 'azdata';
import Severity from 'vs/base/common/severity';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';
import { IQuickInputService, IQuickPickItem } from 'vs/platform/quickinput/common/quickInput';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor, IStatusbarEntry } from 'vs/workbench/services/statusbar/common/statusbar';

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
			case mssqlProviderName:
				return 'MSSQL';
			default:
				return this.providerId;
		}
	}

	public static getDefaultLabel(): string {
		return nls.localize('chooseSqlLang', "Choose SQL Language");
	}
}

// Shows SQL flavor status in the editor
export class SqlFlavorStatusbarItem extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.flavor';

	private statusItem: IStatusbarEntryAccessor;

	private _sqlStatusEditors: { [editorUri: string]: SqlProviderEntry };

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: EditorServiceImpl,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService
	) {
		super();
		this._sqlStatusEditors = {};

		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: nls.localize('changeProvider', "Change SQL language provider"),
				ariaLabel: nls.localize('changeProvider', "Change SQL language provider"),
				command: 'sql.action.editor.changeProvider'
			},
				SqlFlavorStatusbarItem.ID,
				nls.localize('status.query.flavor', "SQL Language Flavor"),
				StatusbarAlignment.RIGHT, 100)
		);

		this._register(this.connectionManagementService.onLanguageFlavorChanged((changeParams: DidChangeLanguageFlavorParams) => this._onFlavorChanged(changeParams)));
		this._register(this.editorService.onDidVisibleEditorsChange(() => this._onEditorsChanged()));
		this._register(this.editorService.onDidCloseEditor(event => this._onEditorClosed(event)));
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(SqlFlavorStatusbarItem.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(SqlFlavorStatusbarItem.ID, true);
	}

	private _onEditorClosed(event: IEditorCloseEvent): void {
		let uri = event.editor.resource?.toString();
		if (uri && uri in this._sqlStatusEditors) {
			// If active editor is being closed, hide the query status.
			let activeEditor = this.editorService.activeEditorPane;
			if (activeEditor) {
				let currentUri = activeEditor.input.resource?.toString();
				if (uri === currentUri) {
					this.hide();
				}
			}
			// note: intentionally not removing language flavor. This is preserved across close/open events at present
			// delete this._sqlStatusEditors[uri];
		}
	}

	private _onEditorsChanged(): void {
		let activeEditor = this.editorService.activeEditorPane;
		if (activeEditor) {
			let uri = activeEditor.input.resource?.toString();

			// Show active editor's language flavor	status
			if (uri) {
				this._showStatus(uri);
			} else {
				this.hide();
			}
		} else {
			this.hide();
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
		let activeEditor = this.editorService.activeEditorPane;
		if (activeEditor) {
			let currentUri = activeEditor.input.resource?.toString();
			if (uri === currentUri) {
				let flavor: SqlProviderEntry = this._sqlStatusEditors[uri];
				if (flavor) {
					this.updateFlavorElement(flavor.label);
				} else {
					this.updateFlavorElement(SqlProviderEntry.getDefaultLabel());
				}
				this.show();
			}
		}
	}

	private updateFlavorElement(text: string): void {
		const props: IStatusbarEntry = {
			text,
			ariaLabel: text,
			command: 'sql.action.editor.changeProvider'
		};

		this.statusItem.update(props);
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

	public run(): Promise<any> {
		let activeEditor = this._editorService.activeEditorPane;
		let currentUri = activeEditor?.input.resource?.toString();
		if (this._connectionManagementService.isConnected(currentUri)) {
			let currentProvider = this._connectionManagementService.getProviderIdFromUri(currentUri);
			return this._showMessage(Severity.Info, nls.localize('alreadyConnected',
				"A connection using engine {0} exists. To change please disconnect or change connection", currentProvider));
		}

		const editorWidget = getCodeEditor(activeEditor.getControl());
		if (!editorWidget) {
			return this._showMessage(Severity.Info, nls.localize('noEditor', "No text editor active at this time"));
		}

		// TODO #1334 use connectionManagementService.GetProviderNames here. The challenge is that the credentials provider is returned
		// so we need a way to filter this using a capabilities check, with isn't yet implemented

		let providerNameToDisplayNameMap = this._connectionManagementService.providerNameToDisplayNameMap;
		let providerOptions = Object.keys(this._connectionManagementService.getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap)).map(p => new SqlProviderEntry(p));

		return this._quickInputService.pick(providerOptions, { placeHolder: nls.localize('pickSqlProvider', "Select SQL Language Provider") }).then(provider => {
			if (provider) {
				let activeEditor = this._editorService.activeEditorPane.getControl();
				const editorWidget = getCodeEditor(activeEditor);
				if (editorWidget) {
					if (currentUri) {
						this._connectionManagementService.doChangeLanguageFlavor(currentUri, 'sql', provider.providerId);
					}
				}
			}
		});
	}

	private _showMessage(sev: Severity, message: string): Promise<any> {
		this._notificationService.notify({
			severity: sev,
			message: message
		});

		return Promise.resolve(undefined);
	}
}
