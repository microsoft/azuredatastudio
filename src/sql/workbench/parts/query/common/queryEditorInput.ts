/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { EditorInput, ConfirmResult } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { IConnectionManagementService, IConnectableInput, INewConnectionParams, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';

import { ISelectionData, ExecutionPlanOptions } from 'azdata';

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
	connectingChange?: boolean;
}

export class QueryEditorState {
	private _connected = false;
	private _resultsVisible = false;
	private _executing = false;
	private _connecting = false;

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
}

/**
 * Input for the QueryEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 * and a UntitledEditorInput for the SQL File Editor.
 */
export abstract class QueryEditorInput extends EditorInput implements IConnectableInput, IDisposable {

	public static SCHEMA: string = 'sql';

	private _state = new QueryEditorState();
	public get state(): QueryEditorState { return this._state; }

	public get onDidChangeDirty(): Event<void> { return this._text.onDidChangeDirty; } // divert to text since we never do this

	constructor(
		private _description: string,
		private _text: EditorInput,
		private _results: QueryResultsInput,
		private _connectionProviderName: string,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IQueryModelService private readonly queryModelService: IQueryModelService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();

		this._toDispose = [];

		// Attach to event callbacks
		// Register callbacks for the Actions
		this._toDispose.push(
			this.queryModelService.onRunQueryStart(uri => {
				if (this.uri === uri) {
					this.onRunQuery();
				}
			})
		);

		this._toDispose.push(
			this.queryModelService.onRunQueryComplete(uri => {
				if (this.uri === uri) {
					this.onQueryComplete();
				}
			})
		);

		this._toDispose.push(this.connectionManagementService.onDisconnect(result => {
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

		this._toDispose.push(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectedKeys.includes('sql.showConnectionInfoInTitle')) {
				this._onDidChangeLabel.fire();
			}
		}));

		this.onDisconnect();
		this.onQueryComplete();
	}

	// Getters for private properties
	public get uri(): string { return this.getResource().toString(); }
	public get text(): EditorInput { return this._text; }
	public get results(): QueryResultsInput { return this._results; }
	// Description is shown beside the tab name in the combobox of open editors
	public getDescription(): string { return this._description; }
	public supportsSplitEditor(): boolean { return false; }
	public revert(): Promise<boolean> { return this._text.revert(); }

	public matches(otherInput: any): boolean {
		if (otherInput instanceof QueryEditorInput) {
			return this._text.matches(otherInput._text);
		}

		return this._text.matches(otherInput);
	}

	// Forwarding resource functions to the inline sql file editor
	public save(): Promise<boolean> { return this._text.save(); }
	public isDirty(): boolean { return this._text.isDirty(); }
	public confirmSave(): Promise<ConfirmResult> { return this._text.confirmSave(); }
	public getResource(): URI { return this._text.getResource(); }

	public getName(longForm?: boolean): string {
		if (this.configurationService.getValue('sql.showConnectionInfoInTitle')) {
			let profile = this.connectionManagementService.getConnectionProfile(this.uri);
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
				title += localize('disconnected', 'disconnected');
			}
			return this._text.getName() + (longForm ? (' - ' + title) : ` - ${trimTitle(title)}`);
		} else {
			return this._text.getName();
		}
	}

	// Called to get the tooltip of the tab
	public getTitle(): string {
		return this.getName(true);
	}

	// State update funtions
	public runQuery(selection: ISelectionData, executePlanOptions?: ExecutionPlanOptions): void {
		this.queryModelService.runQuery(this.uri, selection, this, executePlanOptions);
		this.state.executing = true;
	}

	public runQueryStatement(selection: ISelectionData): void {
		this.queryModelService.runQueryStatement(this.uri, selection, this);
		this.state.executing = true;
	}

	public runQueryString(text: string): void {
		this.queryModelService.runQueryString(this.uri, text, this);
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

		let isRunningQuery = this.queryModelService.isRunningQuery(this.uri);
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
	}

	public onDisconnect(): void {
		this.state.connected = false;
	}

	public onRunQuery(): void {
		this.state.executing = true;
		this.state.resultsVisible = true;
	}

	public onQueryComplete(): void {
		this.state.executing = false;
	}

	// Clean up functions
	public dispose(): void {
		this._text.dispose();
		this._results.dispose();
		this._toDispose = dispose(this._toDispose);
		super.dispose();
	}

	public close(): void {
		this.queryModelService.disposeQuery(this.uri);
		this.connectionManagementService.disconnectEditor(this, true);

		this._text.close();
		this._results.close();
		super.close();
	}

	/**
	 * Get the color that should be displayed
	 */
	public get tabColor(): string {
		return this.connectionManagementService.getTabColorForUri(this.uri);
	}
}
