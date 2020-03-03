/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtHostQueryShape, MainThreadQueryShape, SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import type * as azdata from 'azdata';
import type * as vscode from 'vscode';
import { URI } from 'vs/base/common/uri';
import { mapToSerializable } from 'sql/base/common/map';
import { Disposable } from 'vs/workbench/api/common/extHostTypes';

export class ExtHostQuery implements ExtHostQueryShape {

	private static _handlePool: number = 0;
	private readonly _proxy: MainThreadQueryShape;

	private readonly messageRunner = new RunOnceScheduler(() => this.sendMessages(), 1000);
	private readonly queuedMessages = new Map<number, Map<string, azdata.IResultMessage[]>>();
	private readonly providers = new Map<number, azdata.QueryProvider>();

	private _nextHandle(): number {
		return ExtHostQuery._handlePool++;
	}

	constructor(
		mainContext: IMainContext,
		private uriTransformer: IURITransformer | null
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadQuery);
	}

	$cancelQuery(handle: number, ownerUri: string): Promise<azdata.QueryCancelResult> {
		return Promise.resolve(this._resolveProvider(handle).cancelQuery(ownerUri));
	}

	$runQuery(handle: number, ownerUri: string, selection?: azdata.ISelectionData, runOptions?: azdata.ExecutionPlanOptions): Promise<void> {
		if (this.uriTransformer) {
			ownerUri = URI.from(this.uriTransformer.transformIncoming(URI.parse(ownerUri))).toString(true);
		}

		return Promise.resolve(this._resolveProvider(handle).runQuery(ownerUri, selection, runOptions));
	}

	$runQueryStatement(handle: number, ownerUri: string, line: number, column: number): Promise<void> {
		return Promise.resolve(this._resolveProvider(handle).runQueryStatement(ownerUri, line, column));
	}

	$runQueryString(handle: number, ownerUri: string, queryString: string): Promise<void> {
		return Promise.resolve(this._resolveProvider(handle).runQueryString(ownerUri, queryString));
	}

	$runQueryAndReturn(handle: number, ownerUri: string, queryString: string): Promise<azdata.SimpleExecuteResult> {
		return Promise.resolve(this._resolveProvider(handle).runQueryAndReturn(ownerUri, queryString));
	}

	$setQueryExecutionOptions(handle: number, ownerUri: string, options: azdata.QueryExecutionOptions): Promise<void> {
		if (this._resolveProvider(handle).setQueryExecutionOptions) {
			return Promise.resolve(this._resolveProvider(handle).setQueryExecutionOptions(ownerUri, options));
		} else {
			return Promise.resolve();
		}
	}

	$getQueryRows(handle: number, rowData: azdata.QueryExecuteSubsetParams): Promise<azdata.QueryExecuteSubsetResult> {
		if (this.uriTransformer) {
			rowData.ownerUri = URI.from(this.uriTransformer.transformIncoming(URI.parse(rowData.ownerUri))).toString(true);
		}
		return Promise.resolve(this._resolveProvider(handle).getQueryRows(rowData));
	}

	$parseSyntax(handle: number, ownerUri: string, query: string): Promise<azdata.SyntaxParseResult> {
		return Promise.resolve(this._resolveProvider(handle).parseSyntax(ownerUri, query));
	}

	$disposeQuery(handle: number, ownerUri: string): Promise<void> {
		if (this.uriTransformer) {
			ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(ownerUri))).toString(true);
		}
		return Promise.resolve(this._resolveProvider(handle).disposeQuery(ownerUri));
	}

	registerProvider(provider: azdata.QueryProvider): vscode.Disposable {
		// TODO reenable adding this to the global providers
		const handle = this._nextHandle();

		provider.registerOnQueryComplete(result => {
			if (this.uriTransformer) {
				result.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(result.ownerUri))).toString(true);
			}
			// clear messages to maintain the order of things
			if (this.messageRunner.isScheduled()) {
				this.messageRunner.cancel();
				this.sendMessages();
			}
			this._proxy.$onQueryComplete(handle, result);
		});

		provider.registerOnBatchStart(batchInfo => {
			if (this.uriTransformer) {
				batchInfo.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(batchInfo.ownerUri))).toString(true);
			}
			this._proxy.$onBatchStart(handle, batchInfo);
		});

		provider.registerOnBatchComplete(batchInfo => {
			if (this.uriTransformer) {
				batchInfo.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(batchInfo.ownerUri))).toString(true);
			}
			this._proxy.$onBatchComplete(handle, batchInfo);
		});

		provider.registerOnResultSetAvailable(resultSetInfo => {
			if (this.uriTransformer) {
				resultSetInfo.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(resultSetInfo.ownerUri))).toString(true);
			}
			this._proxy.$onResultSetAvailable(handle, resultSetInfo);
		});

		provider.registerOnResultSetUpdated(resultSetInfo => {
			if (this.uriTransformer) {
				resultSetInfo.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(resultSetInfo.ownerUri))).toString(true);
			}
			this._proxy.$onResultSetUpdated(handle, resultSetInfo);
		});

		provider.registerOnMessage(message => {
			this.handleMessage(handle, message);
		});

		provider.registerOnEditSessionReady((ownerUri: string, success: boolean, message: string) => {
			this._proxy.$onEditSessionReady(handle, ownerUri, success, message);
		});

		this.providers.set(handle, provider);
		this._proxy.$registerProvider(provider.providerId, handle);

		return new Disposable(() => {
			this._proxy.$unregisterProvider(handle);
			this.providers.delete(handle);
		});
	}

	private handleMessage(handle: number, message: azdata.QueryExecuteMessageParams): void {
		if (this.uriTransformer) {
			message.ownerUri = URI.from(this.uriTransformer.transformOutgoing(URI.parse(message.ownerUri))).toString(true);
		}
		if (!this.queuedMessages.has(handle)) {
			this.queuedMessages.set(handle, new Map<string, azdata.IResultMessage[]>());
		}
		if (!this.queuedMessages.get(handle).has(message.ownerUri)) {
			this.queuedMessages.get(handle).set(message.ownerUri, []);
		}
		this.queuedMessages.get(handle).get(message.ownerUri).push(message.message);
		if (!this.messageRunner.isScheduled()) {
			this.messageRunner.schedule();
		}
	}

	private sendMessages() {
		const messages = mapToSerializable(this.queuedMessages, v => mapToSerializable(v));
		this.queuedMessages.clear();
		this._proxy.$onQueryMessage(messages);
	}

	private _resolveProvider(handle: number): azdata.QueryProvider {
		let provider = this.providers.get(handle);
		if (provider) {
			return provider;
		} else {
			throw new Error(`Unfound provider ${handle}`);
		}
	}
}
