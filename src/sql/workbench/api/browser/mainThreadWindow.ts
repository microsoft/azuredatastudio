/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MainThreadWindowShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { Disposable } from 'vs/base/common/lifecycle';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadWindow)
export class MainThreadWindow extends Disposable implements MainThreadWindowShape {

	constructor(
		extHostContext: IExtHostContext,
		@IFileBrowserDialogController fileBrowserDialogService: IFileBrowserDialogController
	) {
		super();
	}
	$openFileBrowserDialog(): Promise<string> {
		throw new Error('Method not implemented.');
	}

}
