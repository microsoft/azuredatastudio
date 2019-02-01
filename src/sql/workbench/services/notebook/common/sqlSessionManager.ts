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
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { escape } from 'sql/base/common/strings';
import { BatchSummary } from 'sqlops';

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
	private _currentConnection: IConnectionProfile;
	static kernelId: number = 0;

	private _id: string;
	private _future: SQLFuture;

	constructor( @IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService) {
		super();
	}

	public get id(): string {
		if (this._id === undefined) {
			this._id = (SqlKernel.kernelId++).toString();
		}
		return this._id;
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
		let canRun: boolean = true;
		if (this._queryRunner) {
			// Cancel any existing query
			if (this._future && !this._queryRunner.hasCompleted) {
				this._queryRunner.cancelQuery().then(ok => undefined, error => this._errorMessageService.showDialog(Severity.Error, sqlKernelError, error));
				// TODO when we can just show error as an output, should show an "execution canceled" error in output
				this._future.handleDone();
			}
			this._queryRunner.runQuery(content.code);
		} else if (this._currentConnection) {
			let connectionUri = Utils.generateUri(this._currentConnection, 'notebook');
			this._queryRunner = this._instantiationService.createInstance(QueryRunner, connectionUri);
			this._connectionManagementService.connect(this._currentConnection, connectionUri).then((result) =>
			{
				this.addQueryEventListeners(this._queryRunner);
				this._queryRunner.runQuery(content.code);
			});
		} else {
			canRun = false;
		}

		this._future = new SQLFuture(this._queryRunner);
		if (!canRun) {
			// Complete early
			this._future.handleDone(new Error(localize('connectionRequired', 'A connection must be chosen to run notebook cells')));
		}

		// TODO should we  cleanup old future? I don't think we need to
		return this._future;
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
			// TODO handle showing a messages output (should be updated with all messages, only changing 1 output in total)
			if (message.isError) {
				this._errorMessageService.showDialog(Severity.Error, sqlKernelError, message.message);
			}
		}));
		this._register(queryRunner.addListener(EventType.BATCH_COMPLETE, batch => {
			if (this._future) {
				this._future.handleBatchEnd(batch);
			}
		}));
	}

	private async queryComplete(): Promise<void> {
		if (this._future) {
			this._future.handleDone();
		}
		// let batches = this._queryRunner.batchSets;
		// // currently only support 1 batch set 1 resultset
		// if (batches.length > 0) {
		// 	let batch = batches[0];
		// 	if (batch.resultSetSummaries.length > 0
		// 		&& batch.resultSetSummaries[0].rowCount > 0
		// 	) {
		// 		let resultset = batch.resultSetSummaries[0];
		// 		this._columns = resultset.columnInfo;
		// 		let rows: QueryExecuteSubsetResult;
		// 		try {
		// 			rows = await this._queryRunner.getQueryRows(0, resultset.rowCount, batch.id, resultset.id);
		// 		} catch (e) {
		// 			return Promise.reject(e);
		// 		}
		// 		this._rows = rows.resultSubset.rows;
		// 	}
		// }
		// TODO issue #2746 should ideally show a warning inside the dialog if have no data
	}
}

export class SQLFuture extends Disposable implements FutureInternal {
	private _msg: nb.IMessage = undefined;
	private ioHandler: nb.MessageHandler<nb.IIOPubMessage>;
	private doneHandler: nb.MessageHandler<nb.IShellMessage>;
	private doneDeferred = new Deferred<nb.IShellMessage>();

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
		return this.doneDeferred.promise;
	}

	public handleDone(err?: Error): void {
		let msg: nb.IShellMessage = {
			channel: 'shell',
			type: 'execute_reply',
			content: { status: 'ok' },
			header: undefined,
			metadata: {},
			parent_header: undefined
		};
		this._msg = msg;
		if (this.doneHandler) {
			this.doneHandler.handle(msg);
		}
		this.doneDeferred.resolve(msg);
		// TODO we should reject where some failure happened?
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

	public handleBatchEnd(batch: BatchSummary): void {
		if (this.ioHandler) {
			for (let resultSet of batch.resultSetSummaries) {
				let rowCount = resultSet.rowCount > MAX_ROWS ? MAX_ROWS : resultSet.rowCount;
				this._queryRunner.getQueryRows(0, rowCount, resultSet.batchId, resultSet.id).then(d => {
					let columns = resultSet.columnInfo;

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
							execution_count: 1,
							data: { 'application/vnd.dataresource+json': this.convertToDataResource(columns, d), 'text/html': this.convertToHtmlTable(columns, d) }
						},
						metadata: undefined,
						parent_header: undefined
					};
					this.ioHandler.handle(msg);
				});
			}
		}
	}

	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		this.ioHandler = handler;
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