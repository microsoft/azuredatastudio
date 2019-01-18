/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import {
	SqlExtHostContext, ExtHostSerializationProviderShape,
	MainThreadSerializationProviderShape, SqlMainContext
} from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ISerializationService } from 'sql/platform/serialization/common/serializationService';
import * as sqlops from 'sqlops';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadSerializationProvider)
export class MainThreadSerializationProvider implements MainThreadSerializationProviderShape {

	private _proxy: ExtHostSerializationProviderShape;

	private _toDispose: IDisposable[];

	private _registrations: { [handle: number]: IDisposable; } = Object.create(null);

	constructor(
		extHostContext: IExtHostContext,
		@ISerializationService private serializationService: ISerializationService

	) {
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostSerializationProvider);
		}
	}

	public dispose(): void {
		this._toDispose = dispose(this._toDispose);
	}

	public $registerSerializationProvider(handle: number): TPromise<any> {
		let self = this;

		this._registrations[handle] = this.serializationService.addEventListener(handle, {
			onSaveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Thenable<sqlops.SaveResultRequestResult> {
				return self._proxy.$saveAs(saveFormat, savePath, results, appendToFile);
			}
		});

		return undefined;
	}

	public $unregisterSerializationProvider(handle: number): TPromise<any> {
		let registration = this._registrations[handle];
		if (registration) {
			registration.dispose();
			delete this._registrations[handle];
		}
		return undefined;
	}
}
