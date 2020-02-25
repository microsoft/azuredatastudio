/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnection, ConnectionState, IConnectionService } from 'sql/platform/connection/common/connectionService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IDisposable, combinedDisposable, toDisposable, Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { Event, Emitter } from 'vs/base/common/event';

export const IQueryService = createDecorator<IQueryService>('queryService');

export interface IQueryProvider {
	readonly id: string;
	readonly onMessage: Event<IResultMessage | IResultMessage[]>;
	readonly onBatchStart: Event<void>;
	readonly onResultSetAvailable: Event<void>;
	readonly onResultSetUpdated: Event<void>;
	readonly onBatchComplete: Event<void>;
	readonly onQueryComplete: Event<void>;
	runQuery(connectionId: string, file: URI): Promise<void>;
	fetchSubset(connectionId: string, resultSetId: number, batchId: number, offset: number, count: number): Promise<IFetchResponse>;
}

export interface IQueryService {
	_serviceBrand: undefined;
	registerProvider(provider: IQueryProvider): IDisposable;
	/**
	 * Create a new query or return on if it already exists given the uri
	 * Will return undefined if the connection is not connected
	 * @param connection
	 * @param forceNew force create a new query even if one already exists for the given connection
	 * This should only be done if it is known that the connection supports multiple queries on the same connection (unlikely)
	 */
	createOrGetQuery(connection: IConnection, associatedURI?: URI, forceNew?: boolean): IQuery | undefined;
}

export interface IResultMessage {
	message: string;
	isError?: boolean;
}

export interface IResultSet {
	//TBD
	readonly id: string;
	readonly rowCount: number;
	readonly completed?: boolean;
	readonly columns: ReadonlyArray<IColumn>;
	fetch(offset: number, count: number): Promise<IFetchResponse>;
}

export interface IFetchResponse {
	rowCount: number;
	rows: Array<Array<any>>;
}

export interface IColumn {
	title: string;
	type: ColumnType;
}

export enum ColumnType {
	XML,
	JSON,
	UNKNOWN
}

export enum QueryState {
	EXECUTING,
	NOT_EXECUTING
}

export interface IQuery {
	/**
	 * Connection associated with this query
	 */
	readonly connection: IConnection;
	/**
	 * File associated with this query
	 */
	readonly associatedFile: URI;
	/**
	 * State of the query
	 */
	readonly state: QueryState;
	readonly onDidStateChange: Event<QueryState>;

	/**
	 * Execute the query with the associatedFile for this query
	 */
	execute(): Promise<void>;

	/**
	 * Messages returned from the query
	 */
	readonly messages: ReadonlyArray<IResultMessage>;
	/**
	 * Result sets returned from the query
	 */
	readonly resultSets: ReadonlyArray<IResultSet>;

	// events
	onResultSetAvailable: Event<IResultSet>;
	onResultSetUpdated: Event<IResultSet>;
	onQueryComplete: Event<void>;
	onMessage: Event<IResultMessage | IResultMessage[]>;

	//TBD
	onBatchStart: Event<void>;
	onBatchComplete: Event<void>;
}

class Query extends Disposable implements IQuery {

	private _state: QueryState = QueryState.NOT_EXECUTING;
	public get state(): QueryState { return this._state; }

	private readonly _onDidStateChange = new Emitter<QueryState>();
	public readonly onDidStateChange = this._onDidStateChange.event;

	private readonly _onMessage = new Emitter<IResultMessage | IResultMessage[]>();
	public readonly onMessage = this._onMessage.event;

	private readonly _onResultSetAvailable = new Emitter<IResultSet>();
	public readonly onResultSetAvailable = this._onResultSetAvailable.event;

	private readonly _onResultSetUpdated = new Emitter<IResultSet>();
	public readonly onResultSetUpdated = this._onResultSetUpdated.event;

	private readonly _onQueryComplete = new Emitter<void>();
	public readonly onQueryComplete = this._onQueryComplete.event;

	//#region TBD
	private _onBatchStart = new Emitter<void>();
	public readonly onBatchStart = this._onBatchStart.event;

	private _onBatchComplete = new Emitter<void>();
	public readonly onBatchComplete = this._onBatchComplete.event;
	//#endregion

	private _messages: Array<IResultMessage> = [];
	public get messages(): ReadonlyArray<IResultMessage> {
		return this._messages;
	}

	private _resultSets: Array<IResultSet> = [];
	public get resultSets(): ReadonlyArray<IResultSet> {
		return this._resultSets;
	}

	constructor(
		private readonly queryService: QueryService,
		public readonly connection: IConnection,
		public readonly associatedFile: URI
	) {
		super();
	}

	private setState(state: QueryState) {
		if (state !== this.state) {
			this._state = state;
			this._onDidStateChange.fire(this.state);
		}
	}

	async execute(): Promise<void> {
		this.setState(QueryState.EXECUTING);
		await this.queryService.executeQuery(this.connection, this.associatedFile);
	}

	private fetch(resultSetId: number, batchId: number, offset: number, count: number): Promise<IFetchResponse> {
		return this.queryService.fetchData(this.connection, resultSetId, batchId, offset, count);
	}
}

export class QueryService extends Disposable implements IQueryService {
	_serviceBrand: undefined;

	private readonly queryProviders = new Map<string, { provider: IQueryProvider, disposable: IDisposable }>(); // providers that have been registered
	private readonly queries = new WeakMap<IConnection, Query>();

	constructor(
		@IConnectionService private readonly connectionService: IConnectionService
	) {
		super();
	}

	createOrGetQuery(connection: IConnection, associatedURI: URI, forceNew: boolean = false): IQuery | undefined {
		const existing = this.queries.get(connection);
		if (existing && !forceNew) {
			return existing;
		}
		const query = connection.state === ConnectionState.CONNECTED ? new Query(this, connection, associatedURI) : undefined;
		if (query) {
			this.queries.set(connection, query);
		}
		return query;
	}

	registerProvider(provider: IQueryProvider): IDisposable {
		const disposable = combinedDisposable(
			provider.onMessage(e => this.onMessage(e)),
			provider.onBatchStart(e => this.onBatchStart(e)),
			provider.onResultSetAvailable(e => this.onResultSetAvailable(e)),
			provider.onResultSetUpdated(e => this.onResultSetUpdated(e)),
			provider.onBatchComplete(e => this.onBatchComplete(e)),
			provider.onQueryComplete(e => this.onQueryComplete(e)),
			toDisposable(() => this.queryProviders.delete(provider.id))
		);
		const providerStub = {
			disposable,
			provider
		};
		this.queryProviders.set(provider.id, providerStub);
		return disposable;
	}

	private onMessage(e: IResultMessage | IResultMessage[]): any {
		throw new Error('Method not implemented.');
	}

	private onBatchStart(e: void): any {
		throw new Error('Method not implemented.');
	}

	private onResultSetAvailable(e: void): any {
		throw new Error('Method not implemented.');
	}

	private onResultSetUpdated(e: void): any {
		throw new Error('Method not implemented.');
	}

	private onBatchComplete(e: void): any {
		throw new Error('Method not implemented.');
	}

	private onQueryComplete(e: void): any {
		throw new Error('Method not implemented.');
	}

	executeQuery(connection: IConnection, file: URI): Promise<void> {
		const providerStub = this.queryProviders.get(connection.provider);
		if (!providerStub) {
			throw new Error(`Provider could not be found: ${connection.provider}`);
		}
		const connectionId = this.connectionService.getIdForConnection(connection);
		return providerStub.provider.runQuery(connectionId, file);
	}

	fetchData(connection: IConnection, resultSetId: number, batchId: number, offset: number, count: number): Promise<IFetchResponse> {
		const providerStub = this.queryProviders.get(connection.provider);
		if (!providerStub) {
			throw new Error(`Provider could not be found: ${connection.provider}`);
		}
		const connectionId = this.connectionService.getIdForConnection(connection);
		return providerStub.provider.fetchSubset(connectionId, resultSetId, batchId, offset, count);
	}
}

registerSingleton(IQueryService, QueryService, true);
