/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { EditorInput, ConfirmResult, EncodingMode, IEncodingSupport } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IFileService } from 'vs/platform/files/common/files';

import { IConnectionManagementService, IConnectableInput, INewConnectionParams, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';

import { ISelectionData, ExecutionPlanOptions } from 'azdata';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';

const MAX_SIZE = 13;

type PublicPart<T> = { [K in keyof T]: T[K] };

function trimTitle(title: string): string {
	const length = title.length;
	const diff = length - MAX_SIZE;

	if (Math.sign(diff) <= 0) {
		return title;
	} else {
		const start = (length / 2) - (diff / 2);
		return title.slice(0, start) + '...' + title.slice(start + diff, length);
	}
}

export interface IQueryEditorStateChange {
	connectedChange?: boolean;
	resultsVisibleChange?: boolean;
	executingChange?: boolean;
	connectingChange?: boolean;
	sqlCmdModeChanged?: boolean;
}

export class QueryEditorState extends Disposable {
	private _connected = false;
	private _isSqlCmdMode = false;
	private _resultsVisible = false;
	private _executing = false;
	private _connecting = false;

	private _onChange = this._register(new Emitter<IQueryEditorStateChange>());
	public onChange = this._onChange.event;

	public set connected(val: boolean) {
		if (val !== this._connected) {
			this._connected = val;
			this._onChange.fire({ connectedChange: true });
		}
	}

	public get connected(): boolean {
		return this._connected;
	}

	public set connecting(val: boolean) {
		if (val !== this._connecting) {
			this._connecting = val;
			this._onChange.fire({ connectingChange: true });
		}
	}

	public get connecting(): boolean {
		return this._connecting;
	}

	public set resultsVisible(val: boolean) {
		if (val !== this._resultsVisible) {
			this._resultsVisible = val;
			this._onChange.fire({ resultsVisibleChange: true });
		}
	}

	public get resultsVisible(): boolean {
		return this._resultsVisible;
	}

	public set executing(val: boolean) {
		if (val !== this._executing) {
			this._executing = val;
			this._onChange.fire({ executingChange: true });
		}
	}

	public get executing(): boolean {
		return this._executing;
	}

	public set isSqlCmdMode(val: boolean) {
		if (val !== this._isSqlCmdMode) {
			this._isSqlCmdMode = val;
			this._onChange.fire({ sqlCmdModeChanged: true });
		}
	}

	public get isSqlCmdMode(): boolean {
		return this._isSqlCmdMode;
	}
}

/**
 * Input for the QueryEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 * and a UntitledEditorInput for the SQL File Editor.
 */
export class QueryInput extends EditorInput implements IEncodingSupport, IConnectableInput, PublicPart<UntitledEditorInput>, IDisposable {

	public static ID: string = 'workbench.editorinputs.queryInput';
	public static SCHEMA: string = 'sql';

	private _state = this._register(new QueryEditorState());
	public get state(): QueryEditorState { return this._state; }

	private _updateSelection: Emitter<ISelectionData>;

	constructor(
		private _description: string,
		private _sql: UntitledEditorInput,
		private _results: QueryResultsInput,
		private _connectionProviderName: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IFileService private _fileService: IFileService
	) {
		super();
		this._updateSelection = new Emitter<ISelectionData>();

		this._register(this._sql);
		this._register(this._results);

		// re-emit sql editor events through this editor if it exists
		if (this._sql) {
			this._register(this._sql.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
		}

		// Attach to event callbacks
		if (this._queryModelService) {
			// Register callbacks for the Actions
			this._register(
				this._queryModelService.onRunQueryStart(uri => {
					if (this.uri === uri) {
						this.onRunQuery();
					}
				})
			);

			this._register(
				this._queryModelService.onRunQueryComplete(uri => {
					if (this.uri === uri) {
						this.onQueryComplete();
					}
				})
			);
		}

		if (this._connectionManagementService) {
			this._register(this._connectionManagementService.onDisconnect(result => {
				if (result.connectionUri === this.uri) {
					this.onDisconnect();
				}
			}));
			if (this.uri) {
				if (this._connectionProviderName) {
					this._connectionManagementService.doChangeLanguageFlavor(this.uri, 'sql', this._connectionProviderName);
				} else {
					this._connectionManagementService.ensureDefaultLanguageFlavor(this.uri);
				}
			}
		}

		if (this._configurationService) {
			this._register(this._configurationService.onDidChangeConfiguration(e => {
				if (e.affectedKeys.includes('sql.showConnectionInfoInTitle')) {
					this._onDidChangeLabel.fire();
				}
			}));
		}

		this.onDisconnect();
		this.onQueryComplete();
	}

	// Getters for private properties
	public get uri(): string { return this.getResource().toString(true); }
	public get sql(): UntitledEditorInput { return this._sql; }
	public get results(): QueryResultsInput { return this._results; }
	public updateSelection(selection: ISelectionData): void { this._updateSelection.fire(selection); }
	public getTypeId(): string { return QueryInput.ID; }
	// Description is shown beside the tab name in the combobox of open editors
	public getDescription(): string { return this._description; }
	public supportsSplitEditor(): boolean { return false; }
	public getMode(): string { return QueryInput.SCHEMA; }
	public revert(): Promise<boolean> { return this._sql.revert(); }
	public setMode(mode: string) {
		this._sql.setMode(mode);
	}

	public matches(otherInput: any): boolean {
		if (otherInput instanceof QueryInput) {
			return this._sql.matches(otherInput.sql);
		}

		return this._sql.matches(otherInput);
	}

	// Forwarding resource functions to the inline sql file editor
	public get onDidModelChangeContent(): Event<void> { return this._sql.onDidModelChangeContent; }
	public get onDidModelChangeEncoding(): Event<void> { return this._sql.onDidModelChangeEncoding; }
	public resolve(): Promise<UntitledEditorModel & IResolvedTextEditorModel> { return this._sql.resolve(); }
	public save(): Promise<boolean> { return this._sql.save(); }
	public isDirty(): boolean { return this._sql.isDirty(); }
	public confirmSave(): Promise<ConfirmResult> { return this._sql.confirmSave(); }
	public getResource(): URI { return this._sql.getResource(); }
	public getEncoding(): string { return this._sql.getEncoding(); }
	public suggestFileName(): string { return this._sql.suggestFileName(); }
	hasBackup(): boolean {
		if (this.sql) {
			return this.sql.hasBackup();
		}

		return false;
	}

	public matchInputInstanceType(inputType: any): boolean {
		return (this._sql instanceof inputType);
	}

	public inputFileExists(): Promise<boolean> {
		return this._fileService.exists(this.getResource());
	}

	public getName(longForm?: boolean): string {
		if (this._configurationService.getValue('sql.showConnectionInfoInTitle')) {
			let profile = this._connectionManagementService.getConnectionProfile(this.uri);
			let title = '';
			if (this._description && this._description !== '') {
				title = this._description + ' ';
			}
			if (profile) {
				if (profile.userName) {
					title += `${profile.serverName}.${profile.databaseName} (${profile.userName})`;
				} else {
					title += `${profile.serverName}.${profile.databaseName} (${profile.authenticationType})`;
				}
			} else {
				title += localize('disconnected', "disconnected");
			}
			return this._sql.getName() + (longForm ? (' - ' + title) : ` - ${trimTitle(title)}`);
		} else {
			return this._sql.getName();
		}
	}

	// Called to get the tooltip of the tab
	public getTitle() {
		return this.getName(true);
	}

	public get hasAssociatedFilePath(): boolean { return this._sql.hasAssociatedFilePath; }

	public setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): void {
		this._sql.setEncoding(encoding, mode);
	}

	// State update funtions
	public runQuery(selection: ISelectionData, executePlanOptions?: ExecutionPlanOptions): void {
		this._queryModelService.runQuery(this.uri, selection, this, executePlanOptions);
		this.state.executing = true;
	}

	public runQueryStatement(selection: ISelectionData): void {
		this._queryModelService.runQueryStatement(this.uri, selection, this);
		this.state.executing = true;
	}

	public runQueryString(text: string): void {
		this._queryModelService.runQueryString(this.uri, text, this);
		this.state.executing = true;
	}

	public onConnectStart(): void {
		this.state.connecting = true;
		this.state.connected = false;
	}

	public onConnectReject(): void {
		this.state.connecting = false;
		this.state.connected = false;
	}

	public onConnectCanceled(): void {
		this.state.connecting = false;
		this.state.connected = false;
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		this.state.connected = true;
		this.state.connecting = false;

		let isRunningQuery = this._queryModelService.isRunningQuery(this.uri);
		if (!isRunningQuery && params && params.runQueryOnCompletion) {
			let selection: ISelectionData = params ? params.querySelection : undefined;
			if (params.runQueryOnCompletion === RunQueryOnConnectionMode.executeCurrentQuery) {
				this.runQueryStatement(selection);
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.executeQuery) {
				this.runQuery(selection);
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.estimatedQueryPlan) {
				this.runQuery(selection, { displayEstimatedQueryPlan: true });
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.actualQueryPlan) {
				this.runQuery(selection, { displayActualQueryPlan: true });
			}
		}
		this._onDidChangeLabel.fire();
	}

	public onDisconnect(): void {
		this.state.connected = false;
		this._onDidChangeLabel.fire();
	}

	public onRunQuery(): void {
		this.state.executing = true;
		this.state.resultsVisible = true;
	}

	public onQueryComplete(): void {
		this.state.executing = false;
	}

	public close(): void {
		this._queryModelService.disposeQuery(this.uri);
		this._connectionManagementService.disconnectEditor(this, true);

		this._sql.close();
		this._results.close();
		super.close();
	}

	/**
	 * Get the color that should be displayed
	 */
	public get tabColor(): string {
		return this._connectionManagementService.getTabColorForUri(this.uri);
	}

	public get isSharedSession(): boolean {
		return this.uri && this.uri.startsWith('vsls:');
	}
}
