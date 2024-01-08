/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { GroupIdentifier, IRevertOptions, ISaveOptions, EditorInputCapabilities, IUntypedEditorInput, Verbosity } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { IConnectionManagementService, IConnectableInput, INewConnectionParams, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { ExecutionPlanOptions } from 'azdata';
import { IRange } from 'vs/editor/common/core/range';
import { AbstractTextResourceEditorInput } from 'vs/workbench/common/editor/textResourceEditorInput';
import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';

const MAX_SIZE = 13;

export function trimTitle(title: string): string {
	const length = title.length;
	const diff = length - MAX_SIZE;

	if (diff <= 0) {
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
	actualExecutionPlanModeChanged?: boolean;
}

export class QueryEditorState extends Disposable {
	private _connected = false;
	private _isSqlCmdMode = false;
	private _resultsVisible = false;
	private _executing = false;
	private _connecting = false;
	private _isActualExecutionPlanMode = false;

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

	public set isActualExecutionPlanMode(val: boolean) {
		if (val !== this._isActualExecutionPlanMode) {
			this._isActualExecutionPlanMode = val;
			this._onChange.fire({ actualExecutionPlanModeChanged: true });
		}
	}

	public get isActualExecutionPlanMode() {
		return this._isActualExecutionPlanMode;
	}

	public setState(newState: QueryEditorState): void {
		this.connected = newState.connected;
		this.connecting = newState.connecting;
		this.resultsVisible = newState.resultsVisible;
		this.executing = newState.executing;
		this.isSqlCmdMode = newState.isSqlCmdMode;
		this.isActualExecutionPlanMode = newState.isActualExecutionPlanMode;
	}
}

/**
 * Input for the QueryEditor. This input is simply a wrapper around a QueryResultsInput for the QueryResultsEditor
 * and a UntitledEditorInput for the SQL File Editor.
 */
export abstract class QueryEditorInput extends EditorInput implements IConnectableInput, IDisposable {

	public static SCHEMA: string = 'sql';

	private _state = this._register(new QueryEditorState());
	public get state(): QueryEditorState { return this._state; }

	constructor(
		private _description: string | undefined,
		protected _text: AbstractTextResourceEditorInput,
		protected _results: QueryResultsInput,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IQueryModelService private readonly queryModelService: IQueryModelService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService protected readonly instantiationService: IInstantiationService,
		@IServerContextualizationService private readonly serverContextualizationService: IServerContextualizationService
	) {
		super();

		this._register(this._text);
		this._register(this._results);

		this._text.onDidChangeDirty(() => this._onDidChangeDirty.fire());

		this._register(
			this.queryModelService.onRunQueryStart(uri => {
				if (this.uri === uri) {
					this.onRunQuery();
				}
			})
		);

		this._register(
			this.queryModelService.onRunQueryComplete(uri => {
				if (this.uri === uri) {
					this.onQueryComplete();
				}
			})
		);

		this._register(this.connectionManagementService.onDisconnect(result => {
			if (result.connectionUri === this.uri) {
				this.onDisconnect();
			}
		}));

		this._register(this.connectionManagementService.onConnectionChanged(e => {
			this._onDidChangeLabel.fire();
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectedKeys.has('queryEditor')) {
				this._onDidChangeLabel.fire();
			}
		}));

		this.connectionManagementService.ensureDefaultLanguageFlavor(this.uri);

		this.onDisconnect();
		this.onQueryComplete();
	}

	// Getters for private properties
	public get uri(): string { return this.resource!.toString(true); }
	public get text(): AbstractTextResourceEditorInput { return this._text; }
	public get results(): QueryResultsInput { return this._results; }
	// Description is shown beside the tab name in the combobox of open editors
	public override getDescription(): string | undefined { return this._description; }
	public supportsSplitEditor(): boolean { return false; }
	public override revert(group: GroupIdentifier, options?: IRevertOptions): Promise<void> {
		return this._text.revert(group, options);
	}

	public override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.None;
	}

	public override matches(otherInput: any): boolean {
		// we want to be able to match against our underlying input as well, bascially we are our underlying input
		if (otherInput instanceof QueryEditorInput) {
			return this._text.matches(otherInput._text);
		} else {
			return this._text.matches(otherInput);
		}
	}

	protected async changeConnectionUri(newUri: string): Promise<void> {
		this.connectionManagementService.changeConnectionUri(newUri, this.uri);
		try {
			await this.queryModelService.changeConnectionUri(newUri, this.uri);
		}
		catch (error) {
			this.connectionManagementService.changeConnectionUri(this.uri, newUri);
			throw error;
		}
	}

	// Forwarding resource functions to the inline sql file editor
	public override isDirty(): boolean { return this._text.isDirty(); }
	public get resource(): URI { return this._text.resource; }

	public override getName(longForm?: boolean): string {
		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').showConnectionInfoInTitle) {
			let profile = this.connectionManagementService.getConnectionProfile(this.uri);
			let info = this.connectionManagementService.getConnectionInfo(this.uri);
			let title = '';

			if (info?.serverConnectionId) {
				// Add server info to query editor in case if it's available
				title += `(${info.serverConnectionId}) `;
			}

			if (this._description && this._description !== '') {
				title += this._description + ' ';
			}

			if (profile) {
				if (profile.connectionName) {
					title += `${profile.connectionName}`;
				}
				else {
					title += `${profile.serverName}`;
					if (profile.databaseName) {
						title += `.${profile.databaseName}`;
					}
					title += ` (${profile.userName || profile.authenticationType})`;
				}
			} else {
				title += localize('disconnected', "disconnected");
			}

			return this.text.getName() + (longForm ? (' - ' + title) : ` - ${trimTitle(title)}`);
		} else {
			return this.text.getName();
		}
	}

	override save(group: GroupIdentifier, options?: ISaveOptions): Promise<IUntypedEditorInput | undefined> {
		return this.text.save(group, options);
	}

	// Called to get the tooltip of the tab
	public override getTitle(verbosity?: Verbosity): string {
		let profile = this.connectionManagementService.getConnectionProfile(this.uri);
		let info = this.connectionManagementService.getConnectionInfo(this.uri);
		let fullTitle = '';

		if (info?.serverConnectionId) {
			// Add server info to query editor in case if it's available
			fullTitle += `(${info.serverConnectionId}) `;
		}

		if (this._description && this._description !== '') {
			fullTitle += this._description + ' ';
		}

		if (profile) {
			let additionalOptions = this.connectionManagementService.getNonDefaultOptions(profile);
			fullTitle += `${profile.serverName}`;
			if (profile.databaseName) {
				fullTitle += `.${profile.databaseName}`;
			}
			fullTitle += ` (${profile.userName || profile.authenticationType})`;

			fullTitle += additionalOptions;
		}
		else {
			fullTitle = this.getName(true);
		}
		switch (verbosity) {
			case Verbosity.LONG:
				// Used by tabsTitleControl as the tooltip hover.
				return fullTitle;
			default:
			case Verbosity.SHORT:
			case Verbosity.MEDIUM:
				// Used for header title by tabsTitleControl.
				return this.getName(true);
		}
	}

	// State update funtions
	public runQuery(range?: IRange, executePlanOptions?: ExecutionPlanOptions): void {
		this.queryModelService.runQuery(this.uri, range, executePlanOptions);
		this.state.executing = true;
	}

	public runQueryStatement(range?: IRange): void {
		this.queryModelService.runQueryStatement(this.uri, range);
		this.state.executing = true;
	}

	public runQueryString(text: string): void {
		this.queryModelService.runQueryString(this.uri, text);
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
		// If we're currently connecting and then cancel, set connected state to false
		// Otherwise, keep connected state as it was
		if (this.state.connecting) {
			this.state.connected = false;
		}
		this.state.connecting = false;
	}

	public onConnectSuccess(params?: INewConnectionParams): void {
		this.state.connected = true;
		this.state.connecting = false;

		let isRunningQuery = this.queryModelService.isRunningQuery(this.uri);
		if (!isRunningQuery && params && params.runQueryOnCompletion) {
			let range: IRange | undefined = params ? params.queryRange : undefined;
			if (params.runQueryOnCompletion === RunQueryOnConnectionMode.executeCurrentQuery) {
				this.runQueryStatement(range);
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.executeQuery) {
				this.runQuery(range);
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.estimatedQueryPlan) {
				this.runQuery(range, { displayEstimatedQueryPlan: true });
			} else if (params.runQueryOnCompletion === RunQueryOnConnectionMode.actualQueryPlan) {
				this.runQuery(range, { displayActualQueryPlan: true });
			}
		}
		this._onDidChangeLabel.fire();

		// Intentionally not awaiting, so that contextualization can happen in the background
		void this.serverContextualizationService?.contextualizeUriForCopilot(this.uri);
	}

	public onDisconnect(): void {
		this.state.connected = false;
		if (!this.isDisposed()) {
			this._onDidChangeLabel.fire();
		}
	}

	public onRunQuery(): void {
		this.state.executing = true;
		this.state.resultsVisible = true;
	}

	public onQueryComplete(): void {
		this.state.executing = false;
	}

	/**
	 * Get the color that should be displayed
	 */
	public get tabColor(): string {
		return this.connectionManagementService.getTabColorForUri(this.uri);
	}

	public override dispose() {
		super.dispose(); // we want to dispose first so that for future logic we know we are disposed
		this.queryModelService.disposeQuery(this.uri);
		this.connectionManagementService.disconnectEditor(this, true);
	}

	public get isSharedSession(): boolean {
		return !!(this.uri && this.uri.startsWith('vsls:'));
	}
}
