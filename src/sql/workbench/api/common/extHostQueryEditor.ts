/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostQueryEditorShape, SqlMainContext, MainThreadQueryEditorShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IQueryEvent } from 'sql/platform/query/common/queryModel';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';

class ExtHostQueryDocument implements azdata.queryeditor.QueryDocument {
	constructor(
		public providerId: string,
		public uri: string,
		private _proxy: MainThreadQueryEditorShape) {
	}

	public setExecutionOptions(options: Map<string, any>): Thenable<void> {
		let executionOptions: azdata.QueryExecutionOptions = {
			options: options
		};
		return this._proxy.$setQueryExecutionOptions(this.uri, executionOptions);
	}

	public createQueryTab(tab: azdata.window.DialogTab): void {
		this._proxy.$createQueryTab(this.uri, tab.title, tab.content);
	}

	public connect(connectionProfile: azdata.connection.ConnectionProfile): Thenable<void> {
		return this._proxy.$connectWithProfile(this.uri, connectionProfile);
	}
}

export class ExtHostQueryEditor implements ExtHostQueryEditorShape {

	private _proxy: MainThreadQueryEditorShape;
	private _nextListenerHandle: number = 0;
	private _queryListeners = new Map<number, azdata.queryeditor.QueryEventListener>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadQueryEditor);
	}

	public $connect(fileUri: string, connectionId: string): Thenable<void> {
		return this._proxy.$connect(fileUri, connectionId);
	}

	public $runQuery(fileUri: string, runCurrentQuery: boolean = true): void {
		return this._proxy.$runQuery(fileUri, runCurrentQuery);
	}

	public $registerQueryInfoListener(providerId: string, listener: azdata.queryeditor.QueryEventListener): void {
		this._queryListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerQueryInfoListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public $onQueryEvent(handle: number, fileUri: string, event: IQueryEvent): void {
		let listener: azdata.queryeditor.QueryEventListener = this._queryListeners[handle];
		if (listener) {
			let params = event.params && event.params.planXml ? event.params.planXml : event.params;
			listener.onQueryEvent(event.type, new ExtHostQueryDocument(mssqlProviderName, fileUri, this._proxy), params);
		}
	}

	public $getQueryDocument(fileUri: string): Thenable<azdata.queryeditor.QueryDocument> {
		return new Promise((resolve) => {
			resolve(new ExtHostQueryDocument(mssqlProviderName, fileUri, this._proxy));
		});
	}

}
