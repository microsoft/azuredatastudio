/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, EditorModel, ConfirmResult, EncodingMode } from 'vs/workbench/common/editor';
import { IConnectionManagementService, IConnectableInput, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { Event, Emitter } from 'vs/base/common/event';
import { EditSessionReadyParams } from 'azdata';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { EditDataResultsInput } from 'sql/workbench/parts/editData/browser/editDataResultsInput';
import { IEditorViewState } from 'vs/editor/common/editorCommon';

/**
 * Input for the EditDataEditor.
 */
export class EditDataInput extends EditorInput implements IConnectableInput {
	public static ID: string = 'workbench.editorinputs.editDataInput';
	private _hasBootstrapped: boolean;
	private _editorContainer: HTMLElement;
	private _updateTaskbar: Emitter<EditDataInput>;
	private _editorInitializing: Emitter<boolean>;
	private _showResultsEditor: Emitter<EditDataInput>;
	private _refreshButtonEnabled: boolean;
	private _stopButtonEnabled: boolean;
	private _setup: boolean;
	private _rowLimit: number;
	private _objectType: string;
	private _css: HTMLStyleElement;
	private _useQueryFilter: boolean;

	public savedViewState: IEditorViewState;

	constructor(
		private _uri: URI,
		private _schemaName,
		private _tableName,
		private _sql: UntitledEditorInput,
		private _queryString: string,
		private _results: EditDataResultsInput,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@INotificationService private notificationService: INotificationService
	) {
		super();
		this._hasBootstrapped = false;
		this._updateTaskbar = new Emitter<EditDataInput>();
		this._showResultsEditor = new Emitter<EditDataInput>();
		this._editorInitializing = new Emitter<boolean>();
		this._setup = false;
		this._stopButtonEnabled = false;
		this._refreshButtonEnabled = false;
		this._useQueryFilter = false;

		// re-emit sql editor events through this editor if it exists
		if (this._sql) {
			this._register(this._sql.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
			this._sql.disableSaving();
		}
		this.disableSaving();

		//TODO determine is this is a table or a view
		this._objectType = 'TABLE';

		// Attach to event callbacks
		if (this._queryModelService) {
			let self = this;

			// Register callbacks for the Actions
			this._register(
				this._queryModelService.onRunQueryStart(uri => {
					if (self.uri === uri) {
						self.initEditStart();
					}
				})
			);

			this._register(
				this._queryModelService.onEditSessionReady((result) => {
					if (self.uri === result.ownerUri) {
						self.initEditEnd(result);
					}
				})
			);
		}
	}

	// Getters/Setters
	public get tableName(): string { return this._tableName; }
	public get schemaName(): string { return this._schemaName; }
	public get uri(): string { return this._uri.toString(); }
	public get sql(): UntitledEditorInput { return this._sql; }
	public get results(): EditDataResultsInput { return this._results; }
	public getResultsInputResource(): string { return this._results.uri; }
	public get updateTaskbarEvent(): Event<EditDataInput> { return this._updateTaskbar.event; }
	public get editorInitializingEvent(): Event<boolean> { return this._editorInitializing.event; }
	public get showResultsEditorEvent(): Event<EditDataInput> { return this._showResultsEditor.event; }
	public get stopButtonEnabled(): boolean { return this._stopButtonEnabled; }
	public get refreshButtonEnabled(): boolean { return this._refreshButtonEnabled; }
	public get container(): HTMLElement { return this._editorContainer; }
	public get hasBootstrapped(): boolean { return this._hasBootstrapped; }
	public get setup(): boolean { return this._setup; }
	public get rowLimit(): number { return this._rowLimit; }
	public get objectType(): string { return this._objectType; }
	public showResultsEditor(): void { this._showResultsEditor.fire(undefined); }
	public isDirty(): boolean { return false; }
	public save(): Promise<boolean> { return Promise.resolve(false); }
	public confirmSave(): Promise<ConfirmResult> { return Promise.resolve(ConfirmResult.DONT_SAVE); }
	public getTypeId(): string { return EditDataInput.ID; }
	public setBootstrappedTrue(): void { this._hasBootstrapped = true; }
	public getResource(): URI { return this._uri; }
	public supportsSplitEditor(): boolean { return false; }
	public setupComplete() { this._setup = true; }
	public get queryString(): string {
		return this._queryString;
	}
	public set queryString(queryString: string) {
		this._queryString = queryString;
	}
	public get css(): HTMLStyleElement {
		return this._css;
	}
	public set css(css: HTMLStyleElement) {
		this._css = css;
	}
	public get queryPaneEnabled(): boolean {
		return this._useQueryFilter;
	}
	public set queryPaneEnabled(useQueryFilter: boolean) {
		this._useQueryFilter = useQueryFilter;
	}

	// State Update Callbacks
	public initEditStart(): void {
		this._editorInitializing.fire(true);
		this._refreshButtonEnabled = false;
		this._stopButtonEnabled = true;
		this._updateTaskbar.fire(this);
	}

	public initEditEnd(result: EditSessionReadyParams): void {
		this._refreshButtonEnabled = true;
		this._stopButtonEnabled = false;
		if (!result.success) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: result.message
			});
		}
		this._editorInitializing.fire(false);
		this._updateTaskbar.fire(this);
	}

	public onConnectStart(): void {
		// TODO: Indicate connection started
	}

	public onConnectReject(error?: string): void {
		if (error) {

			this.notificationService.notify({
				severity: Severity.Error,
				message: nls.localize('connectionFailure', "Edit Data Session Failed To Connect")
			});
		}
	}

	public onConnectCanceled(): void {
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		let rowLimit: number = undefined;
		let queryString: string = undefined;
		if (this._useQueryFilter) {
			queryString = this._queryString;
		} else {
			rowLimit = this._rowLimit;
		}

		this._queryModelService.initializeEdit(this.uri, this.schemaName, this.tableName, this._objectType, rowLimit, queryString);
		this.showResultsEditor();
		this._onDidChangeLabel.fire();
	}

	public onDisconnect(): void {
		// TODO: deal with disconnections
	}

	public onRowDropDownSet(rows: number) {
		this._rowLimit = rows;
	}

	// Boiler Plate Functions
	public matches(otherInput: any): boolean {
		if (otherInput instanceof EditDataInput) {
			return this._sql.matches(otherInput.sql);
		}

		return this._sql.matches(otherInput);
	}

	public dispose(): void {
		this._queryModelService.disposeQuery(this.uri);
		this._sql.dispose();
		this._results.dispose();

		super.dispose();
	}

	public close(): void {
		// Dispose our edit session then disconnect our input
		this._queryModelService.disposeEdit(this.uri).then(() => {
			return this._connectionManagementService.disconnectEditor(this, true);
		}).then(() => {
			this.dispose();
		});
	}

	public get tabColor(): string {
		return this._connectionManagementService.getTabColorForUri(this.uri);
	}

	public get onDidModelChangeContent(): Event<void> { return this._sql.onDidModelChangeContent; }
	public get onDidModelChangeEncoding(): Event<void> { return this._sql.onDidModelChangeEncoding; }
	public resolve(refresh?: boolean): Promise<EditorModel> { return this._sql.resolve(); }
	public getEncoding(): string { return this._sql.getEncoding(); }
	public suggestFileName(): string { return this._sql.suggestFileName(); }
	public getName(): string { return this._sql.getName(); }
	public get hasAssociatedFilePath(): boolean { return this._sql.hasAssociatedFilePath; }

	public setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): void {
		this._sql.setEncoding(encoding, mode);
	}
}
