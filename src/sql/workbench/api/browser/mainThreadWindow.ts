/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import { MainThreadWindowShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IFileBrowserDialogController } from 'sql/workbench/services/fileBrowser/common/fileBrowserDialogController';
import { Disposable } from 'vs/base/common/lifecycle';
import { SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(SqlMainContext.MainThreadWindow)
export class MainThreadWindow extends Disposable implements MainThreadWindowShape {

	constructor(
		extHostContext: IExtHostContext,
		@IFileBrowserDialogController private _fileBrowserDialogService: IFileBrowserDialogController
	) {
		super();
	}

	public async $openFileBrowserDialog(connectionUri: string, targetPath: string, fileFilters: azdata.window.FileFilters[]): Promise<string> {
		let completion = new Promise<string>(resolve => {
			let handleOk = (path: string) => {
				resolve(path);
			};
			this._fileBrowserDialogService.showDialog(connectionUri, targetPath, fileFilters, '', true, handleOk);
		});
		return await completion;
	}
}
