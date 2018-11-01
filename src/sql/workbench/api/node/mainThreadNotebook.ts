/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { SqlExtHostContext, SqlMainContext, ExtHostNotebookShape, MainThreadNotebookShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { INotebookService, INotebookProvider, INotebookManager } from 'sql/services/notebook/notebookService';
import URI from 'vs/base/common/uri';

@extHostNamedCustomer(SqlMainContext.MainThreadNotebook)
export class MainThreadNotebook extends Disposable implements MainThreadNotebookShape {

	private _proxy: ExtHostNotebookShape;
	private _registrations: { [handle: number]: NotebookProviderWrapper } = Object.create(null);

	constructor(
		extHostContext: IExtHostContext,
		@INotebookService private notebookService: INotebookService
	) {
		super();
		if (extHostContext) {
			this._proxy = extHostContext.getProxy(SqlExtHostContext.ExtHostNotebook);
		}
	}

	//#region Extension host callable methods
	public $registerNotebookProvider(providerId: string, handle: number): void {
		let notebookProvider = new NotebookProviderWrapper(providerId, handle);
		this._registrations[providerId] = notebookProvider;
		this.notebookService.registerProvider(providerId, notebookProvider);
	}

	public $unregisterNotebookProvider(handle: number): void {
		let registration = this._registrations[handle];
		if (registration) {
			this.notebookService.unregisterProvider(registration.providerId);
			registration.dispose();
			delete this._registrations[handle];
		}
	}

	//#endregion

}

class NotebookProviderWrapper extends Disposable implements INotebookProvider {

	constructor(public readonly providerId, public readonly handle: number) {
		super();
	}

	getNotebookManager(notebookUri: URI): Thenable<INotebookManager> {
		// TODO must call through to setup in the extension host
		return Promise.resolve(new NotebookManagerWrapper(this.providerId));
	}

	handleNotebookClosed(notebookUri: URI): void {
		// TODO implement call through to extension host
	}


}

class NotebookManagerWrapper implements INotebookManager {
	constructor(public readonly providerId) {

	}
	sessionManager: sqlops.nb.SessionManager;
	contentManager: sqlops.nb.ContentManager;
	serverManager: sqlops.nb.ServerManager;

}
