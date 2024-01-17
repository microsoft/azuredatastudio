/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadPerfShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import * as perf from 'vs/base/common/performance';

@extHostNamedCustomer(SqlMainContext.MainThreadPerf)
export class MainThreadPerf implements MainThreadPerfShape {
	constructor(
		context: IExtHostContext,
	) { }

	public $mark(name: string) {
		perf.mark(name);
	}

	public dispose(): void {

	}
}
