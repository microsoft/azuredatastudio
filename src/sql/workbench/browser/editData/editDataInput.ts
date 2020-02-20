/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, EncodingMode, IEditorInput } from 'vs/workbench/common/editor';
import { IConnectionManagementService, IConnectableInput, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { Event, Emitter } from 'vs/base/common/event';
import { EditSessionReadyParams } from 'azdata';
import { URI } from 'vs/base/common/uri';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import Severity from 'vs/base/common/severity';
import { EditDataResultsInput } from 'sql/workbench/browser/editData/editDataResultsInput';
import { IEditorViewState } from 'vs/editor/common/editorCommon';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { IUntitledTextEditorModel, UntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';

/**
 * Input for the EditDataEditor.
 */
export class EditDataInput extends EditorInput implements IConnectableInput {
	public static ID: string = 'workbench.editorinputs.editDataInput';
	private _hasBootstrapped: boolean;
	private _updateTaskbar: Emitter<EditDataInput>;
	private _editorInitializing: Emitter<boolean>;
	private _showResultsEditor: Emitter<EditDataInput | undefined>;
	private _refreshButtonEnabled: boolean;
	private _stopButtonEnabled: boolean;
	private _setup: boolean;
	private _rowLimit?: number;
	private _objectType: string;
	private _useQueryFilter: boolean;

	public savedViewState?: IEditorViewState;

	constructor(
		private _uri: URI,
		private _schemaName: string,
		private _tableName: string,
		private _sql: UntitledTextEditorInput,
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

		// re-emit sql editor events through this editor if it exists.
		// also set dirty status to false to prevent rerendering.
		if (this._sql) {
			this._register(this._sql.onDidChangeDirty(async () => {
				const model = await this._sql.resolve() as UntitledTextEditorModel;
				model.setDirty(false);
				this._onDidChangeDirty.fire();
			}));
		}

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
	public get uri(): string { return unescape(this._uri.toString()); }
	public get sql(): UntitledTextEditorInput { return this._sql; }
	public get results(): EditDataResultsInput { return this._results; }
	public getResultsInputResource(): string { return this._results.uri; }
	public get updateTaskbarEvent(): Event<EditDataInput> { return this._updateTaskbar.event; }
	public get editorInitializingEvent(): Event<boolean> { return this._editorInitializing.event; }
	public get showResultsEditorEvent(): Event<EditDataInput | undefined> { return this._showResultsEditor.event; }
	public get stopButtonEnabled(): boolean { return this._stopButtonEnabled; }
	public get refreshButtonEnabled(): boolean { return this._refreshButtonEnabled; }
	public get hasBootstrapped(): boolean { return this._hasBootstrapped; }
	public get setup(): boolean { return this._setup; }
	public get rowLimit(): number | undefined { return this._rowLimit; }
	public get objectType(): string { return this._objectType; }
	public showResultsEditor(): void { this._showResultsEditor.fire(undefined); }
	public isDirty(): boolean { return false; }
	public save(): Promise<IEditorInput | undefined> { return Promise.resolve(undefined); }
	public getTypeId(): string { return EditDataInput.ID; }
	public setBootstrappedTrue(): void { this._hasBootstrapped = true; }
	public get resource(): URI { return this._uri; }
	public supportsSplitEditor(): boolean { return false; }
	public setupComplete() { this._setup = true; }
	public get queryString(): string {
		return this._queryString;
	}
	public set queryString(queryString: string) {
		this._queryString = queryString;
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
		let rowLimit: number | undefined = undefined;
		let queryString: string | undefined = undefined;
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
		// Dispose our edit session then disconnect our input
		this._queryModelService.disposeEdit(this.uri).then(() => {
			return this._connectionManagementService.disconnectEditor(this, true);
		});
		this._queryModelService.disposeQuery(this.uri);
		this._sql.dispose();
		this._results.dispose();

		super.dispose();
	}

	public get tabColor(): string {
		return this._connectionManagementService.getTabColorForUri(this.uri);
	}

	public resolve(refresh?: boolean): Promise<IUntitledTextEditorModel & IResolvedTextEditorModel> { return this._sql.resolve(); }
	public getEncoding(): string { return this._sql.getEncoding(); }
	public getName(): string { return this._sql.getName(); }
	public get hasAssociatedFilePath(): boolean { return this._sql.model.hasAssociatedFilePath; }

	public setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): void {
		this._sql.setEncoding(encoding, mode);
	}
}
