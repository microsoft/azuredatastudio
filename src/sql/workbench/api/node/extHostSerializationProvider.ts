/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { SqlMainContext, MainThreadSerializationProviderShape, ExtHostSerializationProviderShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';

class SerializationAdapter {
	private _provider: sqlops.SerializationProvider;

	constructor(provider: sqlops.SerializationProvider) {
		this._provider = provider;
	}

	public saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult> {
		return this._provider.saveAs(saveFormat, savePath, results, appendToFile);
	}

}

type Adapter = SerializationAdapter;

export class ExtHostSerializationProvider extends ExtHostSerializationProviderShape {

	private _proxy: MainThreadSerializationProviderShape;

	private static _handlePool: number = 0;
	private _adapter: { [handle: number]: Adapter } = Object.create(null);

	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			delete this._adapter[handle];
			this._proxy.$unregisterSerializationProvider(handle);
		});
	}

	private _nextHandle(): number {
		return ExtHostSerializationProvider._handlePool++;
	}

	private _withAdapter<A, R>(handle: number, ctor: { new(...args: any[]): A }, callback: (adapter: A) => Thenable<R>): Thenable<R> {
		let adapter = this._adapter[handle];
		if (!(adapter instanceof ctor)) {
			return TPromise.wrapError(new Error('no adapter found'));
		}
		return callback(<any>adapter);
	}

	constructor(
		mainContext: IMainContext
	) {
		super();
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadSerializationProvider);
	}

	public $registerSerializationProvider(provider: sqlops.SerializationProvider): vscode.Disposable {
		provider.handle = this._nextHandle();
		this._adapter[provider.handle] = new SerializationAdapter(provider);
		this._proxy.$registerSerializationProvider(provider.handle);
		return this._createDisposable(provider.handle);
	}

	public $saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult> {
		return this._withAdapter(0, SerializationAdapter, adapter => adapter.saveAs(saveFormat, savePath, results, appendToFile));
	}

}
