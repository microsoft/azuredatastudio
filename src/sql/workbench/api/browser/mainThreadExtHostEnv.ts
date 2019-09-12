/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import {
	SqlExtHostContext,
	SqlMainContext,
	ExtHostExtHostEnvShape,
	MainThreadExtHostEnvShape
} from 'sql/workbench/api/common/sqlExtHost.protocol';
import * as azdata from 'azdata';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';


@extHostNamedCustomer(SqlMainContext.MainThreadExtHostEnv)
export class MainThreadExtHostEnv extends Disposable implements MainThreadExtHostEnvShape {
	private _proxy: ExtHostExtHostEnvShape;

	constructor(
		extHostContext: IExtHostContext
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostExtHostEnv);
		}
	}
	public getEnvironment(): Thenable<azdata.ExtHostEnvironment> {
		return this._proxy.$getEnvironment();
	}
}
