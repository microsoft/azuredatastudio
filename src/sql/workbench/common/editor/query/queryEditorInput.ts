/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, Disposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { EditorInput, GroupIdentifier, IRevertOptions, ISaveOptions, IEditorInput, TextResourceEditorInput } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';

import { startsWith } from 'vs/base/common/strings';
import { IConnection, ConnectionState } from 'sql/platform/connection/common/connectionService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IQueryService, IQuery, QueryState } from 'sql/platform/query/common/queryService';

// const MAX_SIZE = 13;

// function trimTitle(title: string): string {
// 	const length = title.length;
// 	const diff = length - MAX_SIZE;

// 	if (diff <= 0) {
// 		return title;
// 	} else {
// 		const start = (length / 2) - (diff / 2);
// 		return title.slice(0, start) + '...' + title.slice(start + diff, length);
// 	}
// }

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
export abstract class QueryEditorInput extends EditorInput implements IDisposable {

	public static SCHEMA: string = 'sql';

	private _state = this._register(new QueryEditorState());
	public get state(): QueryEditorState { return this._state; }

	private _connection?: IConnection;
	public get connection(): IConnection | undefined { return this._connection; }

	private _query?: IQuery;
	public get query(): IQuery | undefined { return this._query; }

	constructor(
		private _description: string,
		protected _text: TextResourceEditorInput,
		protected _results: QueryResultsInput,
		initialConnection: IConnection | undefined,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConnectionDialogService private readonly connectionDialogService: IConnectionDialogService,
		@IQueryService private readonly queryService: IQueryService
	) {
		super();

		this._register(this._text);
		this._register(this._results);

		this._text.onDidChangeDirty(() => this._onDidChangeDirty.fire());

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('sql.showConnectionInfoInTitle')) {
				this._onDidChangeLabel.fire();
			}
		}));

		if (initialConnection) {
			this._connection = initialConnection;

			this._connection.onDidStateChange(() => this.updateConnectionState());
			this.connect(); // intentially run this async
		}
	}

	// Getters for private properties
	public get uri(): string { return this.resource!.toString(true); }
	public get text(): TextResourceEditorInput { return this._text; }
	public get results(): QueryResultsInput { return this._results; }
	// Description is shown beside the tab name in the combobox of open editors
	public getDescription(): string { return this._description; }
	public supportsSplitEditor(): boolean { return false; }
	public revert(group: GroupIdentifier, options?: IRevertOptions): Promise<boolean> {
		return this._text.revert(group, options);
	}

	public isReadonly(): boolean {
		return false;
	}

	public matches(otherInput: any): boolean {
		// we want to be able to match against our underlying input as well, bascially we are our underlying input
		if (otherInput instanceof QueryEditorInput) {
			return this._text.matches(otherInput._text);
		} else {
			return this._text.matches(otherInput);
		}
	}

	// Forwarding resource functions to the inline sql file editor
	public isDirty(): boolean { return this._text.isDirty(); }
	public get resource(): URI { return this._text.resource; }

	public getName(longForm?: boolean): string {
		return this._text.getName();
	}

	public async connect(): Promise<boolean> {
		if (this.connection) {
			switch (this.connection.state) {
				case ConnectionState.CONNECTED:
					return true;
				case ConnectionState.CONNECTING:
					return !((await this.connection.onDidConnect).failed);
				case ConnectionState.DISCONNECTED:
					return !((await this.connection.connect()).failed);
			}
		} else {
			this._connection = await this.connectionDialogService.openDialogAndWait(this.uri);
			this._connection.onDidStateChange(() => this.updateConnectionState());
			this.updateConnectionState();
			return this.connect();
		}
	}

	private updateConnectionState(): void {
		this.state.connected = this.connection.state === ConnectionState.CONNECTED;
		this.state.connecting = this.connection.state === ConnectionState.CONNECTING;
	}

	public async runQuery(): Promise<void> {
		if (this.query) {
			await this.query.execute();
		} else {
			if (await this.connect()) {
				this._query = this.queryService.createOrGetQuery(this.connection, this.resource);
				if (this.query) {
					this.query.onDidStateChange(e => {
						this.state.executing = e === QueryState.EXECUTING;
						this.state.resultsVisible = !this.state.resultsVisible && e === QueryState.EXECUTING;
					});
					this.results.setQuery(this.query);
					await this.query.execute();
				}
			}
		}
	}

	save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		return this.text.save(group, options);
	}

	saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		return this.text.saveAs(group, options);
	}

	// Called to get the tooltip of the tab
	public getTitle(): string {
		return this.getName(true);
	}

	public dispose() {
		super.dispose();
	}

	public get isSharedSession(): boolean {
		return !!(this.uri && startsWith(this.uri, 'vsls:'));
	}
}
