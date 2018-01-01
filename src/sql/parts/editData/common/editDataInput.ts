/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { EditorInput, EditorModel } from 'vs/workbench/common/editor';
import { IConnectionManagementService, IConnectableInput, INewConnectionParams } from 'sql/parts/connection/common/connectionManagement';
import { IMessageService, Severity } from 'vs/platform/message/common/message';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import Event, { Emitter } from 'vs/base/common/event';
import { EditSessionReadyParams } from 'sqlops';
import URI from 'vs/base/common/uri';
import nls = require('vs/nls');

/**
 * Input for the EditDataEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 */
export class EditDataInput extends EditorInput implements IConnectableInput {
	public static ID: string = 'workbench.editorinputs.editDataInput';
	private _visible: boolean;
	private _hasBootstrapped: boolean;
	private _editorContainer: HTMLElement;
	private _updateTaskbar: Emitter<EditDataInput>;
	private _editorInitializing: Emitter<boolean>;
	private _showTableView: Emitter<EditDataInput>;
	private _refreshButtonEnabled: boolean;
	private _stopButtonEnabled: boolean;
	private _setup: boolean;
	private _toDispose: IDisposable[];
	private _rowLimit: number;
	private _objectType: string;

	constructor(private _uri: URI, private _schemaName, private _tableName,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IMessageService private _messageService: IMessageService
	) {
		super();
		this._visible = false;
		this._hasBootstrapped = false;
		this._updateTaskbar = new Emitter<EditDataInput>();
		this._showTableView = new Emitter<EditDataInput>();
		this._editorInitializing = new Emitter<boolean>();
		this._setup = false;
		this._stopButtonEnabled = false;
		this._refreshButtonEnabled = false;
		this._toDispose = [];

		//TODO determine is this is a table or a view
		this._objectType = 'TABLE';

		// Attach to event callbacks
		if (this._queryModelService) {
			let self = this;

			// Register callbacks for the Actions
			this._toDispose.push(
				this._queryModelService.onRunQueryStart(uri => {
					if (self.uri === uri) {
						self.initEditStart();
					}
				})
			);

			this._toDispose.push(
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
	public get updateTaskbar(): Event<EditDataInput> { return this._updateTaskbar.event; }
	public get editorInitializing(): Event<boolean> { return this._editorInitializing.event; }
	public get showTableView(): Event<EditDataInput> { return this._showTableView.event; }
	public get stopButtonEnabled(): boolean { return this._stopButtonEnabled; }
	public get refreshButtonEnabled(): boolean { return this._refreshButtonEnabled; }
	public get container(): HTMLElement { return this._editorContainer; }
	public get hasBootstrapped(): boolean { return this._hasBootstrapped; }
	public get visible(): boolean { return this._visible; }
	public get setup(): boolean { return this._setup; }
	public get rowLimit(): number { return this._rowLimit; }
	public get objectType(): string { return this._objectType; }
	public getTypeId(): string { return EditDataInput.ID; }
	public setVisibleTrue(): void { this._visible = true; }
	public setBootstrappedTrue(): void { this._hasBootstrapped = true; }
	public getResource(): URI { return this._uri; }
	public getName(): string { return this._uri.path; }
	public supportsSplitEditor(): boolean { return false; }
	public setupComplete() { this._setup = true; }
	public set container(container: HTMLElement) {
		this._disposeContainer();
		this._editorContainer = container;
	}

	// State Update Callbacks
	public initEditStart(): void {
		this._editorInitializing.fire(true);
		this._refreshButtonEnabled = false;
		this._stopButtonEnabled = true;
		this._updateTaskbar.fire(this);
	}

	public initEditEnd(result: EditSessionReadyParams): void {
		if (result.success) {
			this._refreshButtonEnabled = true;
			this._stopButtonEnabled = false;
		} else {
			this._refreshButtonEnabled = false;
			this._stopButtonEnabled = false;
			this._messageService.show(Severity.Error, result.message);
		}
		this._editorInitializing.fire(false);
		this._updateTaskbar.fire(this);
	}

	public onConnectStart(): void {
		// TODO: Indicate connection started
	}

	public onConnectReject(error?: string): void {
		if (error) {
			this._messageService.show(Severity.Error, nls.localize('connectionFailure', 'Edit Data Session Failed To Connect'));
		}
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		this._queryModelService.initializeEdit(this.uri, this.schemaName, this.tableName, this._objectType, this._rowLimit);
		this._showTableView.fire(this);
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
			return (this.uri === otherInput.uri);
		}

		return false;
	}

	public resolve(refresh?: boolean): TPromise<EditorModel> {
		return TPromise.as(null);
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (this._editorContainer && this._editorContainer.parentElement) {
			this._editorContainer.parentElement.removeChild(this._editorContainer);
			this._editorContainer = null;
		}
	}

	public close(): void {
		// Dispose our edit session then disconnect our input
		this._queryModelService.disposeEdit(this.uri).then(() => {
			return this._connectionManagementService.disconnectEditor(this, true);
		}).then(() => {
			this.dispose();
			super.close();
		});
	}

	public get tabColor(): string {
		return this._connectionManagementService.getTabColorForUri(this.uri);
	}
}
