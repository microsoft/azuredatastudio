/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { EditorInput, EditorModel, ConfirmResult, EncodingMode, IEncodingSupport } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IEditorViewState } from 'vs/editor/common/editorCommon';

import { IConnectionManagementService, IConnectableInput, INewConnectionParams, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';

import { ISelectionData, ExecutionPlanOptions } from 'sqlops';

const MAX_SIZE = 13;

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

/**
 * Input for the QueryEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 * and a UntitledEditorInput for the SQL File Editor.
 */
export class QueryInput extends EditorInput implements IEncodingSupport, IConnectableInput, IDisposable {

	public static ID: string = 'workbench.editorinputs.queryInput';
	public static SCHEMA: string = 'sql';

	private _runQueryEnabled: boolean;
	private _cancelQueryEnabled: boolean;
	private _connectEnabled: boolean;
	private _disconnectEnabled: boolean;
	private _changeConnectionEnabled: boolean;
	private _listDatabasesConnected: boolean;

	private _updateTaskbar: Emitter<void>;
	private _showQueryResultsEditor: Emitter<void>;
	private _updateSelection: Emitter<ISelectionData>;

	private _currentEventCallbacks: IDisposable[];

	public savedViewState: IEditorViewState;

	constructor(
		private _description: string,
		private _sql: UntitledEditorInput,
		private _results: QueryResultsInput,
		private _connectionProviderName: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super();
		this._updateTaskbar = new Emitter<void>();
		this._showQueryResultsEditor = new Emitter<void>();
		this._updateSelection = new Emitter<ISelectionData>();

		this._toDispose = [];
		this._currentEventCallbacks = [];
		// re-emit sql editor events through this editor if it exists
		if (this._sql) {
			this._toDispose.push(this._sql.onDidChangeDirty(() => this._onDidChangeDirty.fire()));
		}

		// Attach to event callbacks
		if (this._queryModelService) {
			// Register callbacks for the Actions
			this._toDispose.push(
				this._queryModelService.onRunQueryStart(uri => {
					if (this.uri === uri) {
						this.onRunQuery();
					}
				})
			);

			this._toDispose.push(
				this._queryModelService.onRunQueryComplete(uri => {
					if (this.uri === uri) {
						this.onQueryComplete();
					}
				})
			);
		}

		if (this._connectionManagementService) {
			this._toDispose.push(this._connectionManagementService.onDisconnect(result => {
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
			this._toDispose.push(this._configurationService.onDidChangeConfiguration(e => {
				if (e.affectedKeys.includes('sql.showConnectionInfoInTitle')) {
					this._onDidChangeLabel.fire();
				}
			}));
		}

		this.onDisconnect();
		this.onQueryComplete();
	}

	// Getters for private properties
	public get uri(): string { return this.getResource().toString(); }
	public get sql(): UntitledEditorInput { return this._sql; }
	public get results(): QueryResultsInput { return this._results; }
	public get updateTaskbarEvent(): Event<void> { return this._updateTaskbar.event; }
	public get showQueryResultsEditorEvent(): Event<void> { return this._showQueryResultsEditor.event; }
	public get updateSelectionEvent(): Event<ISelectionData> { return this._updateSelection.event; }
	public get runQueryEnabled(): boolean { return this._runQueryEnabled; }
	public get cancelQueryEnabled(): boolean { return this._cancelQueryEnabled; }
	public get connectEnabled(): boolean { return this._connectEnabled; }
	public get disconnectEnabled(): boolean { return this._disconnectEnabled; }
	public get changeConnectionEnabled(): boolean { return this._changeConnectionEnabled; }
	public get listDatabasesConnected(): boolean { return this._listDatabasesConnected; }
	public getQueryResultsInputResource(): string { return this._results.uri; }
	public showQueryResultsEditor(): void { this._showQueryResultsEditor.fire(); }
	public updateSelection(selection: ISelectionData): void { this._updateSelection.fire(selection); }
	public getTypeId(): string { return QueryInput.ID; }
	public getDescription(): string { return this._description; }
	public supportsSplitEditor(): boolean { return false; }
	public getModeId(): string { return QueryInput.SCHEMA; }
	public revert(): TPromise<boolean> { return this._sql.revert(); }

	public matches(otherInput: any): boolean {
		if (otherInput instanceof QueryInput) {
			return this._sql.matches(otherInput.sql);
		}

		return this._sql.matches(otherInput);
	}

	// Forwarding resource functions to the inline sql file editor
	public get onDidModelChangeContent(): Event<void> { return this._sql.onDidModelChangeContent; }
	public get onDidModelChangeEncoding(): Event<void> { return this._sql.onDidModelChangeEncoding; }
	public resolve(refresh?: boolean): TPromise<EditorModel> { return this._sql.resolve(); }
	public save(): TPromise<boolean> { return this._sql.save(); }
	public isDirty(): boolean { return this._sql.isDirty(); }
	public confirmSave(): TPromise<ConfirmResult> { return this._sql.confirmSave(); }
	public getResource(): URI { return this._sql.getResource(); }
	public getEncoding(): string { return this._sql.getEncoding(); }
	public suggestFileName(): string { return this._sql.suggestFileName(); }

	public getName(): string {
		if (this._configurationService.getValue('sql.showConnectionInfoInTitle')) {
			let profile = this._connectionManagementService.getConnectionProfile(this.uri);
			let title = '';
			if (profile) {
				if (profile.userName) {
					title = `${profile.serverName}.${profile.databaseName} (${profile.userName})`;
				} else {
					title = `${profile.serverName}.${profile.databaseName} (${profile.authenticationType})`;
				}
			} else {
				title = localize('disconnected', 'disconnected');
			}

			return this._sql.getName() + ` - ${trimTitle(title)}`;
		} else {
			return this._sql.getName();
		}
	}

	public get hasAssociatedFilePath(): boolean { return this._sql.hasAssociatedFilePath; }

	public setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): void {
		this._sql.setEncoding(encoding, mode);
	}

	// State update funtions
	public runQuery(selection: ISelectionData, executePlanOptions?: ExecutionPlanOptions): void {
		this._queryModelService.runQuery(this.uri, selection, this, executePlanOptions);
		this.showQueryResultsEditor();
	}

	public runQueryStatement(selection: ISelectionData): void {
		this._queryModelService.runQueryStatement(this.uri, selection, this);
		this.showQueryResultsEditor();
	}

	public runQueryString(text: string): void {
		this._queryModelService.runQueryString(this.uri, text, this);
		this.showQueryResultsEditor();
	}

	public onConnectStart(): void {
		this._runQueryEnabled = false;
		this._cancelQueryEnabled = false;
		this._connectEnabled = false;
		this._disconnectEnabled = true;
		this._changeConnectionEnabled = false;
		this._listDatabasesConnected = false;
		this._updateTaskbar.fire();
	}

	public onConnectReject(): void {
		this.onDisconnect();
		this._updateTaskbar.fire();
	}

	public onConnectCanceled(): void {
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		this._runQueryEnabled = true;
		this._connectEnabled = false;
		this._disconnectEnabled = true;
		this._changeConnectionEnabled = true;
		this._listDatabasesConnected = true;

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
		this._updateTaskbar.fire();
		this._onDidChangeLabel.fire();
	}

	public onDisconnect(): void {
		this._runQueryEnabled = true;
		this._cancelQueryEnabled = false;
		this._connectEnabled = true;
		this._disconnectEnabled = false;
		this._changeConnectionEnabled = false;
		this._listDatabasesConnected = false;
		this._updateTaskbar.fire();
	}

	public onRunQuery(): void {
		this._runQueryEnabled = false;
		this._cancelQueryEnabled = true;
		this._updateTaskbar.fire();
	}

	public onQueryComplete(): void {
		this._runQueryEnabled = true;
		this._cancelQueryEnabled = false;
		this._updateTaskbar.fire();
	}

	// Clean up functions
	public dispose(): void {
		this._sql.dispose();
		this._results.dispose();
		this._toDispose = dispose(this._toDispose);
		this._currentEventCallbacks = dispose(this._currentEventCallbacks);
		super.dispose();
	}

	public close(): void {
		this._queryModelService.disposeQuery(this.uri);
		this._connectionManagementService.disconnectEditor(this, true);

		this._sql.close();
		this._results.close();
	}

	/**
	 * Unsubscribe all events in _currentEventCallbacks and set the new callbacks
	 * to be unsubscribed the next time this method is called.
	 *
	 * This method is used to ensure that all callbacks point to the current QueryEditor
	 * in the case that this QueryInput is moved between different QueryEditors.
	 */
	public setEventCallbacks(callbacks: IDisposable[]): void {
		this._currentEventCallbacks = dispose(this._currentEventCallbacks);
		this._currentEventCallbacks = callbacks;
	}

	/**
	 * Get the color that should be displayed
	 */
	public get tabColor(): string {
		return this._connectionManagementService.getTabColorForUri(this.uri);
	}
}