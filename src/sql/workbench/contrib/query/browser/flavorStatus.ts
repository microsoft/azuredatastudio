/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/flavorStatus';
import { Disposable } from 'vs/base/common/lifecycle';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
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
import { IStatusbarService, StatusbarAlignment, IStatusbarEntryAccessor, IStatusbarEntry } from 'vs/workbench/services/statusbar/browser/statusbar';
import { Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

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
	private readonly name = nls.localize('status.query.flavor', "SQL Language Flavor");

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: EditorServiceImpl,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService
	) {
		super();
		this._sqlStatusEditors = {};

		this.statusItem = this._register(
			this.statusbarService.addEntry({
				name: this.name,
				text: nls.localize('changeProvider', "Change SQL language provider"),
				ariaLabel: nls.localize('changeProvider', "Change SQL language provider"),
				command: 'sql.action.editor.changeProvider'
			},
				SqlFlavorStatusbarItem.ID,
				StatusbarAlignment.RIGHT, 100)
		);
		this.hide();
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
			name: this.name,
			text: text,
			ariaLabel: text,
			command: 'sql.action.editor.changeProvider'
		};

		this.statusItem.update(props);
	}
}

export class ChangeFlavorAction extends Action2 {

	public static ID = 'sql.action.editor.changeProvider';
	public static LABEL_ORG = 'Change SQL Engine Provider';
	public static LABEL = nls.localize('changeSqlProvider', "Change SQL Engine Provider");

	constructor() {
		super({
			id: ChangeFlavorAction.ID,
			title: { value: ChangeFlavorAction.LABEL, original: ChangeFlavorAction.LABEL_ORG },
			f1: true
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const connectionManagementService = accessor.get(IConnectionManagementService);

		let activeEditor = editorService.activeEditorPane;
		let currentUri = activeEditor?.input.resource?.toString(true);
		if (connectionManagementService.isConnected(currentUri)) {
			let currentProvider = connectionManagementService.getProviderIdFromUri(currentUri);
			return this._showMessage(notificationService, Severity.Info, nls.localize('alreadyConnected',
				"A connection using engine {0} exists. To change please disconnect or change connection", currentProvider));
		}

		const editorWidget = getCodeEditor(activeEditor.getControl());
		if (!editorWidget) {
			return this._showMessage(notificationService, Severity.Info, nls.localize('noEditor', "No text editor active at this time"));
		}

		// TODO #1334 use connectionManagementService.GetProviderNames here. The challenge is that the credentials provider is returned
		// so we need a way to filter this using a capabilities check, with isn't yet implemented

		let providerNameToDisplayNameMap = connectionManagementService.providerNameToDisplayNameMap;
		let providerOptions = Object.keys(connectionManagementService.getUniqueConnectionProvidersByNameMap(providerNameToDisplayNameMap)).map(p => new SqlProviderEntry(p));

		return quickInputService.pick(providerOptions, { placeHolder: nls.localize('pickSqlProvider', "Select Language Provider") }).then(provider => {
			if (provider) {
				let activeEditor = editorService.activeEditorPane.getControl();
				const editorWidget = getCodeEditor(activeEditor);
				if (editorWidget) {
					if (currentUri) {
						connectionManagementService.doChangeLanguageFlavor(currentUri, 'sql', provider.providerId);
					}
				}
			}
		});
	}

	private _showMessage(notificationService: INotificationService, sev: Severity, message: string): Promise<any> {
		notificationService.notify({
			severity: sev,
			message: message
		});

		return Promise.resolve(undefined);
	}
}
