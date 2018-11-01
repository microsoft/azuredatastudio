/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { TPromise } from 'vs/base/common/winjs.base';
import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Disposable } from 'vs/workbench/api/node/extHostTypes';
import { localize } from 'vs/nls';


import { ExtHostNotebookShape, MainThreadNotebookShape, SqlMainContext } from 'sql/workbench/api/node/sqlExtHost.protocol';

export class ExtHostNotebook implements ExtHostNotebookShape {
	private static _handlePool: number = 0;

	private readonly _proxy: MainThreadNotebookShape;
	private _providers = new Map<number, sqlops.nb.NotebookProvider>();

	constructor(private _mainContext: IMainContext) {
		this._proxy = _mainContext.getProxy(SqlMainContext.MainThreadNotebook);
	}

	//#region APIs called by main thread
	getNotebookManager(notebookUri: vscode.Uri): Thenable<number> {
		throw new Error('Not implemented');
	}
	handleNotebookClosed(notebookUri: vscode.Uri): void {
		throw new Error('Not implemented');
	}

	//#endregion

	//#region APIs called by extensions
	registerNotebookProvider(provider: sqlops.nb.NotebookProvider): vscode.Disposable {
		if (!provider || !provider.providerId) {
			throw new Error(localize('providerRequired', 'A NotebookProvider with valid providerId must be passed to this method'));
		}
		const handle = this._addNewProvider(provider);
		this._proxy.$registerNotebookProvider(provider.providerId, handle);
		return this._createDisposable(handle);
	}
	//#endregion


	//#region private methods
	private _createDisposable(handle: number): Disposable {
		return new Disposable(() => {
			this._providers.delete(handle);
			this._proxy.$unregisterNotebookProvider(handle);
		});
	}

	private _nextHandle(): number {
		return ExtHostNotebook._handlePool++;
	}

	private _withProvider<A, R>(handle: number, ctor: { new(...args: any[]): A }, callback: (adapter: A) => TPromise<R>): TPromise<R> {
		let provider = this._providers.get(handle);
		if (!(provider instanceof ctor)) {
			return TPromise.wrapError<R>(new Error('no adapter found'));
		}
		return callback(<any>provider);
	}

	private _addNewProvider(adapter: sqlops.nb.NotebookProvider): number {
		const handle = this._nextHandle();
		this._providers.set(handle, adapter);
		return handle;
	}
	//#endregion
}

