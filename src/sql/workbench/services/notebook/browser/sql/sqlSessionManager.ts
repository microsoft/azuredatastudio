/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IResultMessage } from 'azdata';
import { localize } from 'vs/nls';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, IColumn, BatchSummary, ICellValue } from 'sql/workbench/services/query/common/query';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import { Deferred } from 'sql/base/common/promise';
import { Disposable } from 'vs/base/common/lifecycle';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { escape } from 'sql/base/common/strings';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ILogService } from 'vs/platform/log/common/log';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { ILanguageMagic } from 'sql/workbench/services/notebook/browser/notebookService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { URI } from 'vs/base/common/uri';
import { getUriPrefix, uriPrefixes } from 'sql/platform/connection/common/utils';
import { onUnexpectedError } from 'vs/base/common/errors';
import { FutureInternal, notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { tryMatchCellMagic } from 'sql/workbench/services/notebook/browser/utils';

export const sqlKernelError: string = localize("sqlKernelError", "SQL kernel error");
export const MAX_ROWS = 5000;
export const NotebookConfigSectionName = 'notebook';
export const MaxTableRowsConfigName = 'maxTableRows';
export const SqlStopOnErrorConfigName = 'sqlStopOnError';

const languageMagics: ILanguageMagic[] = [{
	language: 'Python',
	magic: 'lang_python'
}, {
	language: 'R',
	magic: 'lang_r'
}, {
	language: 'Java',
	magic: 'lang_java'
}];

export interface SQLData {
	columns: Array<string>;
	rows: Array<Array<string>>;
}

export interface NotebookConfig {
	cellToolbarLocation: string;
	collapseBookItems: boolean;
	diff: { enablePreview: boolean };
	displayOrder: Array<string>;
	kernelProviderAssociations: Array<string>;
	maxBookSearchDepth: number;
	maxTableRows: number;
	overrideEditorTheming: boolean;
	pinnedNotebooks: Array<string>;
	pythonPath: string;
	remoteBookDownloadTimeout: number;
	showAllKernels: boolean;
	showCellStatusBar: boolean;
	sqlStopOnError: boolean;
	trustedBooks: Array<string>;
	useExistingPython: boolean;
}

export interface NotebookConfig {
	cellToolbarLocation: string;
	collapseBookItems: boolean;
	diff: { enablePreview: boolean };
	displayOrder: Array<string>;
	kernelProviderAssociations: Array<string>;
	maxBookSearchDepth: number;
	maxTableRows: number;
	overrideEditorTheming: boolean;
	pinnedNotebooks: Array<string>;
	pythonPath: string;
	remoteBookDownloadTimeout: number;
	showAllKernels: boolean;
	showCellStatusBar: boolean;
	showNotebookConvertActions: boolean;
	sqlStopOnError: boolean;
	trustedBooks: Array<string>;
	useExistingPython: boolean;
}

export class SqlSessionManager implements nb.SessionManager {
	private static _sessions: nb.ISession[] = [];

	constructor(private _instantiationService: IInstantiationService) { }

	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get specs(): nb.IAllKernels {
		let allKernels: nb.IAllKernels = {
			defaultKernel: notebookConstants.sqlKernel,
			kernels: [notebookConstants.sqlKernelSpec]
		};
		return allKernels;
	}

	startNew(options: nb.ISessionOptions): Thenable<nb.ISession> {
		let sqlSession = new SqlSession(options, this._instantiationService);
		let index = SqlSessionManager._sessions.findIndex(session => session.path === options.path);
		if (index > -1) {
			SqlSessionManager._sessions.splice(index);
		}
		SqlSessionManager._sessions.push(sqlSession);
		return Promise.resolve(sqlSession);
	}

	shutdown(id: string): Thenable<void> {
		let index = SqlSessionManager._sessions.findIndex(session => session.id === id);
		if (index > -1) {
			let sessionManager = SqlSessionManager._sessions[index];
			SqlSessionManager._sessions.splice(index);
			if (sessionManager && sessionManager.kernel) {
				let sqlKernel = sessionManager.kernel as SqlKernel;
				return sqlKernel.disconnect();
			}
		}
		return Promise.resolve();
	}

	shutdownAll(): Thenable<void> {
		return Promise.all(SqlSessionManager._sessions.map(session => {
			return this.shutdown(session.id);
		})).then();
	}

	dispose(): void {
		// no-op
	}
}

export class SqlSession implements nb.ISession {
	private _kernel: SqlKernel;
	private _defaultKernelLoaded = false;

	public set defaultKernelLoaded(value) {
		this._defaultKernelLoaded = value;
	}

	public get defaultKernelLoaded(): boolean {
		return this._defaultKernelLoaded;
	}

	constructor(private options: nb.ISessionOptions, private _instantiationService: IInstantiationService) {
		this._kernel = this._instantiationService.createInstance(SqlKernel, options.path);
	}

	public get canChangeKernels(): boolean {
		return true;
	}

	public get id(): string {
		return this.options.kernelId || this.kernel ? this._kernel.id : '';
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
	private _currentConnectionProfile: ConnectionProfile;
	static kernelId: number = 0;

	private _id: string | undefined;
	private _future: SQLFuture | undefined;
	private _executionCount: number = 0;
	private _magicToExecutorMap = new Map<string, ExternalScriptMagic>();
	private _connectionPath: string;

	constructor(private _path: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super();
		this.initMagics();
		this.setConnectionPath();
	}

	private initMagics(): void {
		for (let magic of languageMagics) {
			let scriptMagic = new ExternalScriptMagic(magic.language);
			this._magicToExecutorMap.set(magic.magic, scriptMagic);
		}
	}

	private setConnectionPath(): void {
		if (this._path) {
			let prefix = getUriPrefix(this._path);
			if (!prefix || prefix === uriPrefixes.connection) {
				this._connectionPath = uriPrefixes.notebook.concat(this._path);
			} else if (prefix !== uriPrefixes.notebook) {
				try {
					let uri = URI.parse(this._path);
					if (uri && uri.scheme) {
						this._connectionPath = uri.toString().replace(uri.scheme, uriPrefixes.notebook);
					}
				} catch {
					// Ignore exceptions from URI parsing
				} finally {
					// If _connectionPath hasn't been set yet, set _connectionPath to _path as a last resort
					if (!this._connectionPath) {
						this._connectionPath = this._path;
					}
				}
			}
		}
	}

	public get id(): string {
		if (this._id === undefined) {
			this._id = (SqlKernel.kernelId++).toString();
		}
		return this._id;
	}

	public get name(): string {
		return notebookConstants.sqlKernel;
	}

	public get supportsIntellisense(): boolean {
		return true;
	}

	public get requiresConnection(): boolean {
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
				name: this._connectionManagementService.getProviderLanguageMode(this._currentConnection?.providerName),
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
		this._currentConnectionProfile = new ConnectionProfile(this._capabilitiesService, this._currentConnection);
		this._queryRunner = undefined;
	}

	getSpec(): Thenable<nb.IKernelSpec> {
		return Promise.resolve(notebookConstants.sqlKernelSpec);
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		let canRun: boolean = true;
		let code = this.getCodeWithoutCellMagic(content);
		if (this._queryRunner) {
			// Cancel any existing query
			if (this._future && !this._queryRunner.hasCompleted) {
				this._queryRunner.cancelQuery().then(ok => undefined, error => this._errorMessageService.showDialog(Severity.Error, sqlKernelError, error));
				// TODO when we can just show error as an output, should show an "execution canceled" error in output
				this._future.handleDone().catch(err => onUnexpectedError(err));
			}
			this._connectionManagementService.refreshAzureAccountTokenIfNecessary(this._connectionPath).then(() => {
				this._queryRunner.runQuery(code).catch(err => onUnexpectedError(err));
			}).catch(err => onUnexpectedError(err));
		} else if (this._currentConnection && this._currentConnectionProfile) {
			this._queryRunner = this._instantiationService.createInstance(QueryRunner, this._connectionPath);
			this.addQueryEventListeners(this._queryRunner);
			this._connectionManagementService.connect(this._currentConnectionProfile, this._connectionPath).then((result) => {
				this._queryRunner.runQuery(code).catch(err => onUnexpectedError(err));
			}).catch(err => onUnexpectedError(err));
		} else {
			canRun = false;
		}

		// Only update execution count if this will run. if not, set as undefined in future so cell isn't shown as having run?
		// TODO verify this is "canonical" behavior
		let count = canRun ? ++this._executionCount : undefined;

		this._future = new SQLFuture(this._queryRunner, count, this._configurationService, this.logService);
		if (!canRun) {
			// Complete early
			this._future.handleDone(new Error(localize('connectionRequired', "A connection must be chosen to run notebook cells"))).catch(err => onUnexpectedError(err));
		}

		// TODO should we  cleanup old future? I don't think we need to
		return <nb.IFuture>this._future;
	}

	private getCodeWithoutCellMagic(content: nb.IExecuteRequest): string {
		let code = Array.isArray(content.code) ? content.code.join('') : content.code;
		let firstLineEnd = code.indexOf(this.textResourcePropertiesService.getEOL(URI.file(this._path)));
		let firstLine = code.substring(0, (firstLineEnd >= 0) ? firstLineEnd : 0).trimLeft();
		if (firstLine.startsWith('%%')) {
			// Strip out the line
			code = code.substring(firstLineEnd, code.length);
			// Try and match to an external script magic. If we add more magics later, should handle transforms better
			let magic = tryMatchCellMagic(firstLine);
			if (magic) {
				let executor = this._magicToExecutorMap.get(magic.toLowerCase());
				if (executor) {
					code = executor.convertToExternalScript(code);
				}
			}
		}
		return code;
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
		this._register(queryRunner.onQueryEnd(() => {
			this.queryComplete().catch(error => {
				this._errorMessageService.showDialog(Severity.Error, sqlKernelError, error);
			});
		}));
		this._register(queryRunner.onMessage(messages => {
			// TODO handle showing a messages output (should be updated with all messages, only changing 1 output in total)
			for (const message of messages) {
				if (this._future && isUndefinedOrNull(message.range)) {
					this._future.handleMessage(message);
				}
			}
		}));
		this._register(queryRunner.onResultSet(resultSet => {
			if (this._future) {
				this._future.handleResultSet(resultSet);
			}
		}));
		this._register(queryRunner.onResultSetUpdate(resultSet => {
			if (this._future) {
				this._future.handleResultSetUpdate(resultSet);
			}
		}));
		this._register(queryRunner.onBatchEnd(batch => {
			if (this._future) {
				this._future.handleBatchEnd(batch);
			}
		}));
	}

	private async queryComplete(): Promise<void> {
		if (this._future) {
			await this._future.handleDone();
		}
		// TODO issue #2746 should ideally show a warning inside the dialog if have no data
	}

	public async disconnect(): Promise<void> {
		if (this._connectionPath) {
			if (this._connectionManagementService.isConnected(this._connectionPath)) {
				try {
					await this._connectionManagementService.disconnect(this._connectionPath);
				} catch (err) {
					this.logService.error(err);
				}
			}
		}
		return;
	}
}

export class SQLFuture extends Disposable implements FutureInternal {
	private _msg: nb.IMessage | undefined;
	private ioHandler: nb.MessageHandler<nb.IIOPubMessage> | undefined;
	private doneHandler: nb.MessageHandler<nb.IShellMessage> | undefined;
	private doneDeferred = new Deferred<nb.IShellMessage>();
	private configuredMaxRows: number = MAX_ROWS;
	private _outputAddedPromises: Promise<void>[] = [];
	private _errorOccurred: boolean = false;
	private _stopOnError: boolean = true;
	private _lastRowCountMap: Map<string, number> = new Map<string, number>();
	// Map containing data resource and html table to be saved in notebook
	private _dataToSaveMap: Map<string, any> = new Map<string, any>();
	// Map containing row data returned from SQL Tools Service and used for table rendering
	private _rowsMap: Map<string, any> = new Map<string, any>();

	constructor(
		private _queryRunner: QueryRunner | undefined,
		private _executionCount: number | undefined,
		configurationService: IConfigurationService,
		private readonly logService: ILogService
	) {
		super();
		let config: NotebookConfig = configurationService.getValue(NotebookConfigSectionName);
		if (config) {
			let maxRows = config[MaxTableRowsConfigName] ? config[MaxTableRowsConfigName] : undefined;
			if (maxRows && maxRows > 0) {
				this.configuredMaxRows = maxRows;
			}
			this._stopOnError = !!config[SqlStopOnErrorConfigName];
		}
	}

	get inProgress(): boolean {
		return this._queryRunner ? !this._queryRunner.hasCompleted : false;
	}

	set inProgress(val: boolean) {
		if (this._queryRunner && !val) {
			this._queryRunner.cancelQuery().catch(err => onUnexpectedError(err));
		}
	}

	get msg(): nb.IMessage | undefined {
		return this._msg;
	}

	get done(): Thenable<nb.IShellMessage> {
		return this.doneDeferred.promise;
	}

	public async handleDone(err?: Error): Promise<void> {
		// must wait on all outstanding output updates to complete
		if (this._outputAddedPromises && this._outputAddedPromises.length > 0) {
			// Do not care about error handling as this is handled elsewhere
			await Promise.all(this._outputAddedPromises).catch((err) => undefined);
		}
		let msg: nb.IExecuteReplyMsg = {
			channel: 'shell',
			type: 'execute_reply',
			content: {
				status: this._errorOccurred && this._stopOnError ? 'error' : 'ok',
				execution_count: this._executionCount
			},
			header: undefined,
			metadata: {},
			parent_header: undefined
		};
		this._msg = msg;
		if (this.doneHandler) {
			this.doneHandler.handle(msg);
		}
		this.doneDeferred.resolve(msg);
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

	public handleMessage(msg: IResultMessage | string): void {
		if (this.ioHandler) {
			let message;
			if (typeof msg === 'string') {
				message = this.convertToDisplayMessage(msg);
			}
			else {
				if (msg.isError) {
					message = this.convertToError(msg);
				} else {
					message = this.convertToDisplayMessage(msg);
				}
			}
			if (message) {
				this.ioHandler.handle(message);
			}
		}
	}

	public handleResultSet(resultSet: ResultSetSummary | ResultSetSummary[]): void {
		let resultSets: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultSets = [resultSet];
		} else {
			resultSets = resultSet?.splice(0);
		}
		for (let set of resultSets) {
			let key = set.batchId + '-' + set.id;
			this._lastRowCountMap.set(key, 0);
			// Convert the headers to data resource and html and send to cell model
			let data = {
				'application/vnd.dataresource+json': this.convertHeaderToDataResource(set.columnInfo),
				'text/html': this.convertHeaderToHtmlTable(set.columnInfo)
			};
			this._dataToSaveMap.set(key, data);
			this._rowsMap.set(key, []);
			this.sendIOPubMessage(data, set);
			// If rows are returned in the initial result set, make sure to convert and send to notebook
			if (set.rowCount > 0) {
				this.handleResultSetUpdate(set);
			}
		}
	}

	public handleResultSetUpdate(resultSet: ResultSetSummary | ResultSetSummary[]): void {
		let resultSets: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultSets = [resultSet];
		} else {
			resultSets = resultSet?.splice(0);
		}
		for (let set of resultSets) {
			if (set.rowCount > this.configuredMaxRows) {
				set.rowCount = this.configuredMaxRows;
			}
			let key = set.batchId + '-' + set.id;
			if (set.rowCount !== this._lastRowCountMap.get(key)) {
				this._outputAddedPromises.push(this.queryAndConvertData(set, this._lastRowCountMap.get(key)));
				this._lastRowCountMap.set(key, set.rowCount);
			}
		}
	}

	public handleBatchEnd(batch: BatchSummary): void {
		if (this.ioHandler) {
			for (let set of batch.resultSetSummaries) {
				if (set.rowCount > this.configuredMaxRows) {
					this.handleMessage(localize('sqlMaxRowsDisplayed', "Displaying Top {0} rows.", this.configuredMaxRows));
				}
			}
		}
	}

	public async queryAndConvertData(resultSet: ResultSetSummary, lastRowCount: number): Promise<void> {
		try {
			let key = resultSet.batchId + '-' + resultSet.id;
			// Query for rows and send rows to cell model
			let queryResult = await this._queryRunner.getQueryRows(lastRowCount, resultSet.rowCount - lastRowCount, resultSet.batchId, resultSet.id);
			this.sendIOPubUpdateMessage(queryResult.rows, resultSet);
			let rows = this._rowsMap.get(key);
			this._rowsMap.set(key, rows.concat(queryResult.rows));

			// Convert rows to data resource and html and send to cell model to be saved
			let dataResourceRows = this.convertRowsToDataResource(queryResult.rows);
			let saveData = this._dataToSaveMap.get(key);
			saveData['application/vnd.dataresource+json'].data = saveData['application/vnd.dataresource+json'].data.concat(dataResourceRows);
			let htmlRows = this.convertRowsToHtml(queryResult.rows, key);
			// Last value in array is '</table>' so we want to add row data before that
			saveData['text/html'].splice(saveData['text/html'].length - 1, 0, ...htmlRows);
			this._dataToSaveMap.set(key, saveData);
			this.sendIOPubMessage(saveData, resultSet);
		} catch (err) {
			// TODO should we output this somewhere else?
			this.logService.error(`Error outputting result sets from Notebook query: ${err}`);
		}
	}

	private sendIOPubMessage(data: any, resultSet: ResultSetSummary): void {
		let msg: nb.IIOPubMessage = {
			channel: 'iopub',
			type: 'iopub',
			header: <nb.IHeader>{
				msg_id: undefined,
				msg_type: 'execute_result'
			},
			content: <nb.IExecuteResult>{
				output_type: 'execute_result',
				metadata: undefined,
				execution_count: this._executionCount,
				data: data
			},
			metadata: {
				batchId: resultSet.batchId,
				id: resultSet.id
			},
			parent_header: undefined
		};
		this.ioHandler.handle(msg);
	}

	private sendIOPubUpdateMessage(rows: any, resultSet: ResultSetSummary): void {
		let msg: nb.IIOPubMessage = {
			channel: 'iopub',
			type: 'iopub',
			header: <nb.IHeader>{
				msg_id: undefined,
				msg_type: 'execute_result_update'
			},
			content: <nb.IExecuteResultUpdate>{
				output_type: 'execute_result_update',
				resultSet: resultSet,
				data: rows
			},
			metadata: undefined,
			parent_header: undefined
		};
		this.ioHandler?.handle(msg);
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

	private convertHeaderToDataResource(columns: IColumn[]): IDataResource {
		let columnsResources: IDataResourceSchema[] = [];
		columns.forEach(column => {
			columnsResources.push({ name: escape(column.columnName) });
		});
		let columnsFields: IDataResourceFields = { fields: columnsResources };
		return {
			schema: columnsFields,
			data: []
		};
	}

	private convertHeaderToHtmlTable(columns: IColumn[]): string[] {
		let htmlTable: string[] = new Array(3);
		htmlTable[0] = '<table>';
		if (columns.length > 0) {
			let columnHeaders = '<tr>';
			for (let column of columns) {
				columnHeaders += `<th>${escape(column.columnName)}</th>`;
			}
			columnHeaders += '</tr>';
			htmlTable[1] = columnHeaders;
		}
		htmlTable[2] = '</table>';
		return htmlTable;
	}

	private convertRowsToDataResource(rows: ICellValue[][]): any[] {
		return rows.map(row => {
			let rowObject: { [key: string]: any; } = {};
			row.forEach((val, index) => {
				rowObject[index] = val.displayValue;
			});
			return rowObject;
		});
	}

	private convertRowsToHtml(rows: ICellValue[][], key: string): string[] {
		let htmlStringArr = [];
		for (const row of rows) {
			let rowData = '<tr>';
			for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
				rowData += `<td>${escape(row[columnIndex].displayValue)}</td>`;
			}
			rowData += '</tr>';
			htmlStringArr.push(rowData);
		}
		return htmlStringArr;
	}

	private convertToDisplayMessage(msg: IResultMessage | string): nb.IIOPubMessage | undefined {
		if (msg) {
			let msgData = typeof msg === 'string' ? msg : msg.message;
			return {
				channel: 'iopub',
				type: 'iopub',
				header: <nb.IHeader>{
					msg_id: undefined,
					msg_type: 'display_data'
				},
				content: <nb.IDisplayData>{
					output_type: 'display_data',
					data: { 'text/html': msgData },
					metadata: {}
				},
				metadata: undefined,
				parent_header: undefined
			};
		}
		return undefined;
	}

	private convertToError(msg: IResultMessage | string): nb.IIOPubMessage | undefined {
		this._errorOccurred = true;

		if (msg) {
			let msgData = typeof msg === 'string' ? msg : msg.message;
			return {
				channel: 'iopub',
				type: 'iopub',
				header: <nb.IHeader>{
					msg_id: undefined,
					msg_type: 'error'
				},
				content: <nb.IErrorResult>{
					output_type: 'error',
					evalue: msgData,
					ename: '',
					traceback: []
				},
				metadata: undefined,
				parent_header: undefined
			};
		}
		return undefined;
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

class ExternalScriptMagic {

	constructor(private language: string) {
	}

	public convertToExternalScript(script: string): string {
		return `execute sp_execute_external_script
		@language = N'${this.language}',
		@script = N'${script}'
		`;
	}
}
