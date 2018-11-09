/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Event, Emitter } from 'vs/base/common/event';
import URI from 'vs/base/common/uri';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { EditorInput, EditorModel, ConfirmResult, EncodingMode, IEncodingSupport } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { IConnectionManagementService, IConnectableInput, INewConnectionParams, RunQueryOnConnectionMode, ConnectionType } from 'sql/parts/connection/common/connectionManagement';
import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';

import * as sqlops from 'sqlops';
import { IRange } from 'vs/editor/common/core/range';

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

export interface IQueryEditorStateChange {
	connectedChange?: boolean;
	resultsVisibleChange?: boolean;
	executingChange?: boolean;
}

export class QueryEditorState {
	private _connected = false;
	private _resultsVisible = false;
	private _executing = false;

	private _onChange = new Emitter<IQueryEditorStateChange>();
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
}

/**
 * Input for the QueryEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 * and a UntitledEditorInput for the SQL File Editor.
 */
export class QueryInput extends EditorInput implements IEncodingSupport, IConnectableInput, IDisposable {

	public static ID: string = 'workbench.editorinputs.queryInput';
	public static SCHEMA: string = 'sql';

	private _state = new QueryEditorState();
	public get state(): QueryEditorState { return this._state; }

	constructor(
		private _description: string,
		private _sql: UntitledEditorInput,
		private _results: QueryResultsInput,
		private _connectionProviderName: string,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super();

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

		if (this.connectionManagementService) {
			this._register(this.connectionManagementService.onDisconnect(result => {
				if (result.connectionUri === this.uri) {
					this.onDisconnect();
				}
			}));
			if (this.uri) {
				if (this._connectionProviderName) {
					this.connectionManagementService.doChangeLanguageFlavor(this.uri, 'sql', this._connectionProviderName);
				} else {
					this.connectionManagementService.ensureDefaultLanguageFlavor(this.uri);
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
	public get uri(): string { return this.getResource().toString(); }
	public get sql(): UntitledEditorInput { return this._sql; }
	public get results(): QueryResultsInput { return this._results; }
	public getQueryResultsInputResource(): string { return this._results.uri; }
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
			let profile = this.connectionManagementService.getConnectionProfile(this.uri);
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

	public rebuildIntelliSenseCache(): void {
		this.connectionManagementService.rebuildIntelliSenseCache(this.uri);
	}

	public setEncoding(encoding: string, mode: EncodingMode /* ignored, we only have Encode */): void {
		this._sql.setEncoding(encoding, mode);
	}

	// State update funtions
	public runQuery(range?: IRange, executePlanOptions?: sqlops.ExecutionPlanOptions): void {
		let selection = this.rangeToSelection(range);
		if (this.isConnected()) {
			this._queryModelService.runQuery(this.uri, selection, this, executePlanOptions);
		} else {
			let executionMode = RunQueryOnConnectionMode.executeQuery;
			if (executePlanOptions) {
				if (executePlanOptions.displayActualQueryPlan) {
					executionMode = RunQueryOnConnectionMode.actualQueryPlan;
				}

				if (executePlanOptions.displayEstimatedQueryPlan) {
					executionMode = RunQueryOnConnectionMode.estimatedQueryPlan;
				}
			}
			this.connectEditor(executionMode, range);
		}
	}

	public runQueryStatement(range: IRange): void {
		this._queryModelService.runQueryStatement(this.uri, this.rangeToSelection(range), this);
	}

	public runQueryString(text: string): void {
		if (this.isConnected()) {
			this._queryModelService.runQueryString(this.uri, text, this);
		} else {

		}
	}

	private rangeToSelection(range: IRange): sqlops.ISelectionData {
		return range ? {
			startColumn: range.startColumn - 1,
			startLine: range.startLineNumber - 1,
			endColumn: range.endColumn - 1,
			endLine: range.endLineNumber - 1
		} : undefined;
	}

	/**
	 * Returns the URI of the given editor if it is not undefined and is connected.
	 * Public for testing only.
	 */
	private isConnected(): boolean {
		return this.connectionManagementService.isConnected(this.uri);
	}

	/**
	 * Connects the given editor to it's current URI.
	 * Public for testing only.
	 */
	protected connectEditor(runQueryOnCompletion?: RunQueryOnConnectionMode, range?: IRange): void {
		let params: INewConnectionParams = {
			input: this,
			connectionType: ConnectionType.editor,
			runQueryOnCompletion: runQueryOnCompletion || RunQueryOnConnectionMode.none,
			querySelection: range
		};
		this.connectionManagementService.showConnectionDialog(params);
	}

	public onConnectStart(): void {
	}

	public onConnectReject(): void {
		this.onDisconnect();
	}

	public onConnectCanceled(): void {
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		let isRunningQuery = this._queryModelService.isRunningQuery(this.uri);
		if (!isRunningQuery && params && params.runQueryOnCompletion) {
			let selection = params ? params.querySelection : undefined;
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
		this.state.connected = true;
	}

	public onDisconnect(): void {
		this._onDidChangeLabel.fire();
		this.state.connected = false;
	}

	public onRunQuery(): void {
		this.state.executing = true;
	}

	public onQueryComplete(): void {
		this.state.executing = false;
	}

	// Clean up functions
	public dispose(): void {
		this._sql.dispose();
		this._results.dispose();
		super.dispose();
	}

	public close(): void {
		this._queryModelService.disposeQuery(this.uri);
		this.connectionManagementService.disconnectEditor(this, true);

		this._sql.close();
		this._results.close();
	}

	/**
	 * Get the color that should be displayed
	 */
	public get tabColor(): string {
		return this.connectionManagementService.getTabColorForUri(this.uri);
	}
}
