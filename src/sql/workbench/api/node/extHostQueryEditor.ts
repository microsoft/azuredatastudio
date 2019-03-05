/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostQueryEditorShape, SqlMainContext, MainThreadQueryEditorShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as azdata from 'azdata';

class ExtHostQueryDocument implements azdata.queryeditor.QueryDocument {
	constructor(
		public providerId: string,
		public uri: string,
		private _proxy: MainThreadQueryEditorShape) {
	}

	// get the document's execution options
	getOptions(): Map<string, string> {
		return undefined;
	}

	// set the document's execution optionsß
	setOptions(options: Map<string, string>): void {

	}

	createQueryTab(tab: azdata.window.modelviewdialog.DialogTab): void {
		this._proxy.$createQueryTab(this.uri, tab.title, tab.content);
	}
}

export class ExtHostQueryEditor implements ExtHostQueryEditorShape  {

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

	public $runQuery(fileUri: string): void {
		return this._proxy.$runQuery(fileUri);
	}

	public $registerQueryInfoListener(providerId: string, listener: azdata.queryeditor.QueryEventListener): void {
		this._queryListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerQueryInfoListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public $onExecutionPlanAvailable(handle: number, fileUri: string, planXml: string) : void {
		let listener: azdata.queryeditor.QueryEventListener = this._queryListeners[handle];
		if (listener) {
			listener.onQueryEvent('executionPlan', new ExtHostQueryDocument('MSSQL', fileUri, this._proxy), planXml);
		}
	}

	public $onExecutionStart(handle: number, fileUri:string): void {
		let listener: azdata.queryeditor.QueryEventListener = this._queryListeners[handle];
		if (listener) {
			listener.onQueryEvent('queryStart', new ExtHostQueryDocument('MSSQL', fileUri, this._proxy), undefined);
		}
	}

	public $onExecutionComplete(handle: number, fileUri:string): void {
		let listener: azdata.queryeditor.QueryEventListener = this._queryListeners[handle];
		if (listener) {
			listener.onQueryEvent('queryStop', new ExtHostQueryDocument('MSSQL', fileUri, this._proxy), undefined);
		}
	}
}
