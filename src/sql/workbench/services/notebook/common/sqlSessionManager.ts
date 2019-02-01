/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { nb, QueryExecuteSubsetResult, IDbColumn, DbCellValue } from 'sqlops';
import { localize } from 'vs/nls';
import { FutureInternal } from 'sql/parts/notebook/models/modelInterfaces';
import QueryRunner, { EventType } from 'sql/platform/query/common/queryRunner';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import * as Utils from 'sql/platform/connection/common/utils';
import { Deferred } from 'sql/base/common/promise';
import { Disposable } from 'vs/base/common/lifecycle';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { escape } from 'sql/base/common/strings';

export const sqlKernel: string = localize('sqlKernel', 'SQL');
export const sqlKernelError: string = localize("sqlKernelError", "SQL kernel error");
export const MAX_ROWS = 2000;

let sqlKernelSpec: nb.IKernelSpec = ({
	name: sqlKernel,
	language: 'sql',
	display_name: sqlKernel
});

export interface SQLData {
	columns: Array<string>;
	rows: Array<Array<string>>;
}

export class SqlSessionManager implements nb.SessionManager {
	constructor(private _instantiationService: IInstantiationService) { }

	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get specs(): nb.IAllKernels {
		let allKernels: nb.IAllKernels = {
			defaultKernel: sqlKernel,
			kernels: [sqlKernelSpec]
		};
		return allKernels;
	}

	startNew(options: nb.ISessionOptions): Thenable<nb.ISession> {
		let session = new SqlSession(options, this._instantiationService);
		return Promise.resolve(session);
	}

	shutdown(id: string): Thenable<void> {
		return Promise.resolve();
	}
}

export class SqlSession implements nb.ISession {
	private _kernel: SqlKernel;
	private _defaultKernelLoaded = false;
	private _currentConnection: IConnectionProfile;

	public set defaultKernelLoaded(value) {
		this._defaultKernelLoaded = value;
	}

	public get defaultKernelLoaded(): boolean {
		return this._defaultKernelLoaded;
	}

	constructor(private options: nb.ISessionOptions, private _instantiationService: IInstantiationService) {
		this._kernel = this._instantiationService.createInstance(SqlKernel);
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this.options.kernelId || '';
	}

	public get path(): string {
		return this.options.path;
	}

	public get name(): string {
		return this.options.name || '';
	}

	public get type(): string {
		return this.options.type || '';
	}

	public get status(): nb.KernelStatus {
		return 'connected';
	}

	public get kernel(): nb.IKernel {
		return this._kernel;
	}

	changeKernel(kernelInfo: nb.IKernelSpec): Thenable<nb.IKernel> {
		return Promise.resolve(this.kernel);
	}

	configureKernel(kernelInfo: nb.IKernelSpec): Thenable<void> {
		return Promise.resolve();
	}

	configureConnection(connection: ConnectionProfile): Thenable<void> {
		if (this._kernel) {
			this._kernel.connection = connection;
		}
		return Promise.resolve();
	}
}

class SqlKernel extends Disposable implements nb.IKernel {
	private _queryRunner: QueryRunner;
	private _columns: IDbColumn[];
	private _rows: DbCellValue[][];
	private _currentConnection: IConnectionProfile;
	static kernelId: number = 0;

	constructor( @IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService) {
		super();
	}

	public get id(): string {
		return (SqlKernel.kernelId++).toString();
	}

	public get name(): string {
		return sqlKernel;
	}

	public get supportsIntellisense(): boolean {
		return true;
	}

	public get isReady(): boolean {
		// should we be checking on the tools service status here?
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get info(): nb.IInfoReply {
		let info: nb.IInfoReply = {
			protocol_version: '',
			implementation: '',
			implementation_version: '',
			language_info: {
				name: 'sql',
				version: '',
			},
			banner: '',
			help_links: [{
				text: '',
				url: ''
			}]
		};

		return info;
	}

	public set connection(conn: IConnectionProfile) {
		this._currentConnection = conn;
		this._queryRunner = undefined;
	}

	getSpec(): Thenable<nb.IKernelSpec> {
		return Promise.resolve(sqlKernelSpec);
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		if (this._queryRunner) {
			this._queryRunner.runQuery(content.code);
		} else if (this._currentConnection) {
			let connectionUri = Utils.generateUri(this._currentConnection, 'notebook');
			this._queryRunner = this._instantiationService.createInstance(QueryRunner, connectionUri);
			this._connectionManagementService.connect(this._currentConnection, connectionUri).then((result) =>
			{
				this.addQueryEventListeners(this._queryRunner);
				this._queryRunner.runQuery(content.code);
			});
		}

		return new SQLFuture(this._queryRunner);
	}

	requestComplete(content: nb.ICompleteRequest): Thenable<nb.ICompleteReplyMsg> {
		let response: Partial<nb.ICompleteReplyMsg> = {};
		return Promise.resolve(response as nb.ICompleteReplyMsg);
	}

	interrupt(): Thenable<void> {
		// TODO: figure out what to do with the QueryCancelResult
		return this._queryRunner.cancelQuery().then((cancelResult) => {
		});
	}

	private addQueryEventListeners(queryRunner: QueryRunner): void {
		this._register(queryRunner.addListener(EventType.COMPLETE, () => {
			this.queryComplete().catch(error => {
				this._errorMessageService.showDialog(Severity.Error, sqlKernelError, error);
			});
		}));
		this._register(queryRunner.addListener(EventType.MESSAGE, message => {
			if (message.isError) {
				this._errorMessageService.showDialog(Severity.Error, sqlKernelError, message.message);
			}
		}));
	}

	private async queryComplete(): Promise<void> {
		let batches = this._queryRunner.batchSets;
		// currently only support 1 batch set 1 resultset
		if (batches.length > 0) {
			let batch = batches[0];
			if (batch.resultSetSummaries.length > 0
				&& batch.resultSetSummaries[0].rowCount > 0
			) {
				let resultset = batch.resultSetSummaries[0];
				this._columns = resultset.columnInfo;
				let rows: QueryExecuteSubsetResult;
				try {
					rows = await this._queryRunner.getQueryRows(0, resultset.rowCount, batch.id, resultset.id);
				} catch (e) {
					return Promise.reject(e);
				}
				this._rows = rows.resultSubset.rows;
			}
		}
		// TODO issue #2746 should ideally show a warning inside the dialog if have no data
	}
}

export class SQLFuture extends Disposable implements FutureInternal {
	private _msg: nb.IMessage = undefined;

	constructor(private _queryRunner: QueryRunner) {
		super();
	}
	get inProgress(): boolean {
		return this._queryRunner && !this._queryRunner.hasCompleted;
	}
	set inProgress(val: boolean) {
		if (this._queryRunner && !val) {
			this._queryRunner.cancelQuery();
		}
	}
	get msg(): nb.IMessage {
		return this._msg;
	}

	get done(): Thenable<nb.IShellMessage> {
		let deferred = new Deferred<nb.IShellMessage>();
		try {
			if (this._queryRunner) {
				this._register(this._queryRunner.onBatchEnd(e => {
					let msg: nb.IShellMessage = {
						channel: 'shell',
						type: 'execute_reply',
						content: { status: 'ok' },
						header: undefined,
						metadata: {},
						parent_header: undefined
					};
					this._msg = msg;
					deferred.resolve(msg);
				}));
			} else {
				deferred.resolve();
			}
		} catch {
			return Promise.resolve(undefined);
		}
		return deferred.promise;
	}

	sendInputReply(content: nb.IInputReply): void {
		// no-op
	}

	setReplyHandler(handler: nb.MessageHandler<nb.IShellMessage>): void {
		// no-op
	}
	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		// no-op
	}
	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		if (this._queryRunner) {
			this._register(this._queryRunner.onBatchEnd(batch => {
				let rowCount = batch.resultSetSummaries[0].rowCount > MAX_ROWS ? MAX_ROWS : batch.resultSetSummaries[0].rowCount;
				this._queryRunner.getQueryRows(0, rowCount, 0, 0).then(d => {
					let columns = batch.resultSetSummaries[0].columnInfo;

					let msg: nb.IIOPubMessage = {
						channel: 'iopub',
						type: 'iopub',
						header: <nb.IHeader>{
							msg_id: undefined,
							msg_type: 'execute_result'
						},
						content: <nb.IExecuteResult>{
							output_type: 'execute_result',
							metadata: {},
							execution_count: 0,
							data: { 'application/vnd.dataresource+json': this.convertToDataResource(columns, d), 'text/html': this.convertToHtmlTable(columns, d) }
						},
						metadata: undefined,
						parent_header: undefined
					};
					handler.handle(msg);
				});
			}));
		}
	}
	registerMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}
	removeMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}

	private convertToDataResource(columns: IDbColumn[], d: QueryExecuteSubsetResult): IDataResource {
		let columnsResources: IDataResourceSchema[] = [];
		columns.forEach(column => {
			columnsResources.push({name: escape(column.columnName)});
		});
		let columnsFields: IDataResourceFields = { fields: undefined };
		columnsFields.fields = columnsResources;
		return {
			schema: columnsFields,
			data: d.resultSubset.rows.map(row => {
				let rowObject: { [key: string]: any; } = {};
				row.forEach((val, index) => {
					rowObject[index] = val.displayValue;
				});
				return rowObject;
			})
		};
	}

	private convertToHtmlTable(columns: IDbColumn[], d: QueryExecuteSubsetResult): string {
		let data: SQLData = {
			columns: columns.map(c => escape(c.columnName)),
			rows: d.resultSubset.rows.map(r => r.map(c => c.displayValue))
		};
		let table: HTMLTableElement = document.createElement('table');
		table.createTHead();
		table.createTBody();
		let hrow = <HTMLTableRowElement>table.insertRow();
		// headers
		for (let column of data.columns) {
			let cell = hrow.insertCell();
			cell.innerHTML = column;
		}

		for (let row in data.rows) {
			let hrow = <HTMLTableRowElement>table.insertRow();
			for (let column in data.columns) {
				let cell = hrow.insertCell();
				cell.innerHTML = escape(data.rows[row][column]);
			}
		}
		let tableHtml = '<table>' + table.innerHTML + '</table>';
		return tableHtml;
	}
}

export interface IDataResource {
	schema: IDataResourceFields;
	data: any[];
}

export interface IDataResourceFields {
	fields: IDataResourceSchema[];
}

export interface IDataResourceSchema {
	name: string;
	type?: string;
}