/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb, IResultMessage } from 'azdata';
import { localize } from 'vs/nls';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { ResultSetSummary, ResultSetSubset, IColumn, BatchSummary } from 'sql/workbench/services/query/common/query';
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
import { firstIndex } from 'vs/base/common/arrays';
import { startsWith } from 'vs/base/common/strings';
import { onUnexpectedError } from 'vs/base/common/errors';
import { FutureInternal, notebookConstants } from 'sql/workbench/services/notebook/browser/interfaces';
import { tryMatchCellMagic } from 'sql/workbench/services/notebook/browser/utils';
import { IQueryManagementService } from 'sql/workbench/services/query/common/queryManagement';

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
		let index = firstIndex(SqlSessionManager._sessions, session => session.path === options.path);
		if (index > -1) {
			SqlSessionManager._sessions.splice(index);
		}
		SqlSessionManager._sessions.push(sqlSession);
		return Promise.resolve(sqlSession);
	}

	shutdown(id: string): Thenable<void> {
		let index = firstIndex(SqlSessionManager._sessions, session => session.id === id);
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
	private _queryRunners: Map<string, QueryRunner> = new Map<string, QueryRunner>();
	private _currentConnection: IConnectionProfile;
	private _currentConnectionProfile: ConnectionProfile;
	static kernelId: number = 0;

	private _id: string;
	private _future: SQLFuture;
	private _executionCount: number = 0;
	private _magicToExecutorMap = new Map<string, ExternalScriptMagic>();

	constructor(private _path: string,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@ILogService private readonly logService: ILogService,
		@ITextResourcePropertiesService private readonly textResourcePropertiesService: ITextResourcePropertiesService,
		@IQueryManagementService private queryManagementService: IQueryManagementService
	) {
		super();
		this.initMagics();
	}

	private initMagics(): void {
		for (let magic of languageMagics) {
			let scriptMagic = new ExternalScriptMagic(magic.language);
			this._magicToExecutorMap.set(magic.magic, scriptMagic);
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
		this._queryRunners.clear();
	}

	getSpec(): Thenable<nb.IKernelSpec> {
		return Promise.resolve(notebookConstants.sqlKernelSpec);
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean, cellUri?: string): nb.IFuture {
		let canRun: boolean = true;
		let code = this.getCodeWithoutCellMagic(content);
		let queryRunnerUri = 'queryRunner-' + cellUri;
		let queryRunner: QueryRunner | undefined = this._queryRunners.get(queryRunnerUri);
		if (queryRunner) {
			// Cancel any existing query
			if (this._future && !queryRunner.hasCompleted) {
				queryRunner.cancelQuery().then(ok => undefined, error => this._errorMessageService.showDialog(Severity.Error, sqlKernelError, error));
				// TODO when we can just show error as an output, should show an "execution canceled" error in output
				this._future.handleDone().catch(err => onUnexpectedError(err));
			}
			queryRunner.runQuery(code).catch(err => onUnexpectedError(err));
		} else if (this._currentConnection && this._currentConnectionProfile) {
			queryRunner = this._instantiationService.createInstance(QueryRunner, queryRunnerUri);
			this._queryRunners.set(queryRunnerUri, queryRunner);
			this.queryManagementService.registerRunner(queryRunner, queryRunnerUri);
			this._connectionManagementService.connect(this._currentConnectionProfile, queryRunnerUri).then((result) => {
				this.addQueryEventListeners(queryRunner);
				queryRunner.runQuery(code).catch(err => onUnexpectedError(err));
			}).catch(err => onUnexpectedError(err));
		} else {
			canRun = false;
		}

		// Only update execution count if this will run. if not, set as undefined in future so cell isn't shown as having run?
		// TODO verify this is "canonical" behavior
		let count = canRun ? ++this._executionCount : undefined;

		this._future = new SQLFuture(queryRunner, count, this._configurationService, this.logService);
		if (!canRun) {
			// Complete early
			this._future.handleDone(new Error(localize('connectionRequired', "A connection must be chosen to run notebook cells"))).catch(err => onUnexpectedError(err));
		}

		// TODO should we  cleanup old future? I don't think we need to
		return this._future;
	}

	private getCodeWithoutCellMagic(content: nb.IExecuteRequest): string {
		let code = Array.isArray(content.code) ? content.code.join('') : content.code;
		let firstLineEnd = code.indexOf(this.textResourcePropertiesService.getEOL(URI.file(this._path)));
		let firstLine = code.substring(0, (firstLineEnd >= 0) ? firstLineEnd : 0).trimLeft();
		if (startsWith(firstLine, '%%')) {
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
		let runners = [...this._queryRunners.values()];
		return Promise.all(runners.map(queryRunner => queryRunner.cancelQuery())).then();
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
				this._future.onResultSet(resultSet);
			}
		}));
		this._register(queryRunner.onBatchEnd(batch => {
			if (this._future) {
				this._future.onBatchEnd(batch);
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
		this._queryRunners.forEach(async (queryRunner: QueryRunner, uri: string) => {
			if (this._connectionManagementService.isConnected(uri)) {
				try {
					await this._connectionManagementService.disconnect(uri);
				} catch (err) {
					this.logService.error(err);
				}

			}
		});
		return;
	}
}

export class SQLFuture extends Disposable implements FutureInternal {
	private _msg: nb.IMessage = undefined;
	private ioHandler: nb.MessageHandler<nb.IIOPubMessage>;
	private doneHandler: nb.MessageHandler<nb.IShellMessage>;
	private doneDeferred = new Deferred<nb.IShellMessage>();
	private configuredMaxRows: number = MAX_ROWS;
	private _outputAddedPromises: Promise<void>[] = [];
	private _errorOccurred: boolean = false;
	private _stopOnError: boolean = true;

	constructor(
		private _queryRunner: QueryRunner,
		private _executionCount: number | undefined,
		configurationService: IConfigurationService,
		private readonly logService: ILogService
	) {
		super();
		let config = configurationService.getValue(NotebookConfigSectionName);
		if (config) {
			let maxRows = config[MaxTableRowsConfigName] ? config[MaxTableRowsConfigName] : undefined;
			if (maxRows && maxRows > 0) {
				this.configuredMaxRows = maxRows;
			}
			this._stopOnError = !!config[SqlStopOnErrorConfigName];
		}
	}

	get inProgress(): boolean {
		return this._queryRunner && !this._queryRunner.hasCompleted;
	}
	set inProgress(val: boolean) {
		if (this._queryRunner && !val) {
			this._queryRunner.cancelQuery().catch(err => onUnexpectedError(err));
		}
	}
	get msg(): nb.IMessage {
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
			this.ioHandler.handle(message);
		}
	}

	public onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]): void {
		if (this.ioHandler) {
			this._outputAddedPromises.push(this.sendInitialResultSets(resultSet));
		}
	}

	public onBatchEnd(batch: BatchSummary): void {
		if (this.ioHandler) {
			for (let set of batch.resultSetSummaries) {
				if (set.rowCount > this.configuredMaxRows) {
					this.handleMessage(localize('sqlMaxRowsDisplayed', "Displaying Top {0} rows.", this.configuredMaxRows));
				}
			}
		}
	}

	private async sendInitialResultSets(resultSet: ResultSetSummary | ResultSetSummary[]): Promise<void> {
		try {
			let resultsToAdd: ResultSetSummary[];
			if (!Array.isArray(resultSet)) {
				resultsToAdd = [resultSet];
			} else {
				resultsToAdd = resultSet?.splice(0);
			}
			for (let set of resultsToAdd) {
				this.sendIOPubMessage(set, false);
			}
		} catch (err) {
			// TODO should we output this somewhere else?
			this.logService.error(`Error outputting result sets from Notebook query: ${err}`);
		}
	}

	private sendIOPubMessage(resultSet: ResultSetSummary, conversionComplete?: boolean, subsetResult?: ResultSetSubset): void {
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
				execution_count: this._executionCount,
				// Initial data sent to notebook only contains column headers since
				// onResultSet only returns the column info (and no row data).
				// Row data conversion will be handled in DataResourceDataProvider
				data: {
					'application/vnd.dataresource+json': this.convertToDataResource(resultSet.columnInfo),
					'text/html': this.convertToHtmlTable(resultSet.columnInfo)
				},
				batchId: resultSet.batchId,
				id: resultSet.id,
				queryRunnerUri: this._queryRunner.uri,
			},
			metadata: undefined,
			parent_header: undefined
		};
		this.ioHandler.handle(msg);
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

	private convertToDataResource(columns: IColumn[]): IDataResource {
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

	private convertToHtmlTable(columns: IColumn[]): string[] {
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

	private convertToDisplayMessage(msg: IResultMessage | string): nb.IIOPubMessage {
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

	private convertToError(msg: IResultMessage | string): nb.IIOPubMessage {
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
