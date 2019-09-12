/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as azdata from 'azdata';
import { tmpdir } from 'os';

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { MainThreadExtHostEnvShape, ExtHostExtHostEnvShape, SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';

export class ExtHostExtHostEnv implements ExtHostExtHostEnvShape {
	private _proxy: MainThreadExtHostEnvShape;

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadExtHostEnv);
	}

	public $getEnvironment(): Thenable<azdata.ExtHostEnvironment> {
		const environment = {} as azdata.ExtHostEnvironment;

		environment.tmpdir = URI.file(tmpdir());

		return Promise.resolve(environment);
	}
}
