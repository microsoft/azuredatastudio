'use strict';

import { nb, QueryExecuteSubsetResult, IDbColumn, DbCellValue } from 'sqlops';
import { localize } from 'vs/nls';
import { FutureInternal } from 'sql/parts/notebook/models/modelInterfaces';
import QueryRunner, { EventType } from 'sql/parts/query/execution/queryRunner';
import { IConnectionManagementService, IErrorMessageService } from 'sql/parts/connection/common/connectionManagement';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Severity from 'vs/base/common/severity';
import * as Utils from 'sql/parts/connection/common/utils';
import { Deferred } from 'sql/base/common/promise';

export const tsqlKernel: string = localize('sqlKernel', 'T-SQL');
const tsqlKernelConfigIssue = localize('tsqlKernelConfigIssue', 'Cannot run cells as T-SQL kernel is not configured correctly');

let tsqlKernelSpec: nb.IKernelSpec = ({
	name: tsqlKernel,
	language: 'sql',
	display_name: tsqlKernel
});

export class TSQLSessionManager implements nb.SessionManager {
	constructor(private _instantiationService: IInstantiationService) {}

	public get isReady(): boolean {
		return true;
	}

	public get ready(): Thenable<void> {
		return Promise.resolve();
	}

	public get specs(): nb.IAllKernels {
		let allKernels: nb.IAllKernels = {
			defaultKernel: tsqlKernel,
			kernels: [tsqlKernelSpec]
		};
		return allKernels;
	}

	startNew(options: nb.ISessionOptions): Thenable<nb.ISession> {
		let session = new TSQLSession(options, this._instantiationService);
		return Promise.resolve(session);
	}

	shutdown(id: string): Thenable<void> {
		return Promise.resolve();
	}
}

export class TSQLSession implements nb.ISession {
	private _kernel: TSQLKernel;
	private _defaultKernelLoaded = false;

	public set defaultKernelLoaded(value) {
		this._defaultKernelLoaded = value;
	}

	public get defaultKernelLoaded(): boolean {
		return this._defaultKernelLoaded;
	}

	constructor(private options: nb.ISessionOptions, private _instantiationService: IInstantiationService) {
		this._kernel = this._instantiationService.createInstance(TSQLKernel);
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
}

class TSQLKernel implements nb.IKernel {
	private _queryRunner: QueryRunner;
	private _columns: IDbColumn[];
	private _rows: DbCellValue[][];

	constructor(@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
				@IInstantiationService private _instantiationService: IInstantiationService,
				@IErrorMessageService private _errorMessageService: IErrorMessageService) {
	}

	public get id(): string {
		return '-1';
	}

	public get name(): string {
		return tsqlKernel;
	}

	public get supportsIntellisense(): boolean {
		return false;
	}

	public get isReady(): boolean {
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
				name: '',
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
	getSpec(): Thenable<nb.IKernelSpec> {
		return Promise.resolve(tsqlKernelSpec);
	}

	requestExecute(content: nb.IExecuteRequest, disposeOnDone?: boolean): nb.IFuture {
		if (this._queryRunner) {
			// if (!this._queryRunner.hasCompleted) {
			// 	await this._queryRunner.cancelQuery();
			// }
			// try {
			// 	await this.createNewConnection(this._connectionService.getActiveConnections());
			// } catch (e) {
			// 	return Promise.reject(e);
			// }
			// this._queryRunner.uri = this._connectionUri;
		} else {
			let connectionProfile = this._connectionManagementService.getActiveConnections()[0];
			let connectionUri = Utils.generateUri(connectionProfile, 'notebook');
			this._queryRunner = this._instantiationService.createInstance(QueryRunner, connectionUri, undefined);
			this._connectionManagementService.connect(connectionProfile, connectionUri).then(result => undefined);

			this.addQueryEventListeners(this._queryRunner);
		}

		this._queryRunner.runQuery(content.code);
		return new TSQLFuture(this._queryRunner);
	}

	requestComplete(content: nb.ICompleteRequest): Thenable<nb.ICompleteReplyMsg> {
		let response: Partial<nb.ICompleteReplyMsg> = { };
		return Promise.resolve(response as nb.ICompleteReplyMsg);
	}

	interrupt(): Thenable<void> {
		return Promise.resolve(undefined);
	}

	private addQueryEventListeners(queryRunner: QueryRunner): void {
		queryRunner.addListener(EventType.COMPLETE, () => {
			this.queryComplete().catch(error => {
				this._errorMessageService.showDialog(Severity.Error, localize("tsqlKernelError", "T-SQL kernel error"), error);
			});
		});
		queryRunner.addListener(EventType.MESSAGE, message => {
			if (message.isError) {
				this._errorMessageService.showDialog(Severity.Error, localize("tsqlKernelError", "T-SQL kernel error"), message.message);
			}
		});
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

export class TSQLFuture implements FutureInternal {
	private _msg: nb.IMessage;

	constructor(private _queryRunner: QueryRunner) {
	}
	get inProgress(): boolean {
		return !this._queryRunner.hasCompleted;
	}

	get msg(): nb.IMessage {
		return this._msg;
	}

	get done(): Thenable<nb.IShellMessage> {
		let deferred = new Deferred<nb.IShellMessage> ();
		try {
			this._queryRunner.onResultSet(e => {
				let msg: nb.IShellMessage = {
					channel: 'shell',
					type: 'execute_reply',
					content: { status: 'ok' },
					header: undefined,
					metadata: undefined,
					parent_header: undefined
				};
				this._msg = msg;
				deferred.resolve(msg);
			});
		} catch {
			return Promise.resolve(undefined);
		}
		return deferred.promise;
	}

	sendInputReply(content: nb.IInputReply): void {
		// no-op
	}
	dispose() {
		// No-op
	}

	setReplyHandler(handler: nb.MessageHandler<nb.IShellMessage>): void {
		// no-op
	}
	setStdInHandler(handler: nb.MessageHandler<nb.IStdinMessage>): void {
		// no-op
	}
	setIOPubHandler(handler: nb.MessageHandler<nb.IIOPubMessage>): void {
		/*let shellMsg = this.toIOPubMessage(this._msg);
		handler.handle(shellMsg);

		/*this.futureImpl.onIOPub = (msg) => {
            let shellMsg = this.toIOPubMessage(msg);
            return handler.handle(shellMsg);
        };*/
		setTimeout(() => {
			let msg: nb.IIOPubMessage = {
				channel: 'iopub',
				type: 'iopub',
				header: <nb.IHeader> {
					msg_id: '0',
					msg_type: 'execute_result'
				},
				content: <nb.IExecuteResult> {
					output_type: 'execute_result',
					metadata: {},
					data: { 'text/plain' : '2'},
					executionCount: 0
				},
				metadata: undefined,
				parent_header: undefined
			};
			handler.handle(msg);
		}, 10);
	}
	registerMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}
	removeMessageHook(hook: (msg: nb.IIOPubMessage) => boolean | Thenable<boolean>): void {
		// no-op
	}

	toIOPubMessage(msgImpl: nb.IIOPubMessage): nb.IIOPubMessage {
		return {
			channel: msgImpl.channel,
			type: msgImpl.channel,
			content: msgImpl.content,
			header: msgImpl.header,
			parent_header: msgImpl.parent_header,
			metadata: msgImpl.metadata
		};
	}
}