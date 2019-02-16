/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostQueryEditorShape, SqlMainContext, MainThreadQueryEditorShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';

export class ExtHostQueryEditor implements ExtHostQueryEditorShape  {

	private _proxy: MainThreadQueryEditorShape;
	private _nextListenerHandle: number = 0;
	private _queryListeners = new Map<number, sqlops.QueryInfoListener>();

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

	public $createWebviewPanel(fileUri: string): void {



	}

	public $registerQueryInfoListener(providerId: string, listener: sqlops.QueryInfoListener): void {
		this._queryListeners[this._nextListenerHandle] = listener;
		this._proxy.$registerQueryInfoListener(this._nextListenerHandle, providerId);
		this._nextListenerHandle++;
	}

	public $onExecutionPlanAvailable(handle: number, fileUri: string, planXml: string) : void {
		let listener: sqlops.QueryInfoListener = this._queryListeners[handle];
		if (listener) {
			listener.onExecutionPlanAvailable(fileUri, planXml);
		}
	}

	public $onExecutionStart(handle: number, fileUri:string): void {
		let listener: sqlops.QueryInfoListener = this._queryListeners[handle];
		if (listener) {
			listener.onExecutionStart(fileUri);
		}
	}

	public $onExecutionComplete(handle: number, fileUri:string): void {
		let listener: sqlops.QueryInfoListener = this._queryListeners[handle];
		if (listener) {
			listener.onExecutionComplete(fileUri);
		}
	}
}
