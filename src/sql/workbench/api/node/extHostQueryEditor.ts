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
}
