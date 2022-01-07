/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from 'vs/base/common/lifecycle';
import { ExtHostContext, ExtHostInteractiveShape, IExtHostContext, MainThreadInteractiveShape } from 'vs/workbench/api/common/extHost.protocol'; // {{SQL CARBON EDIT}} Disable unused
// import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers'; {{SQL CARBON EDIT}} Disable unused
import { IInteractiveDocumentService } from 'vs/workbench/contrib/interactive/browser/interactiveDocumentService';

// @extHostNamedCustomer(MainContext.MainThreadInteractive)
export class MainThreadInteractive implements MainThreadInteractiveShape {
	private readonly _proxy: ExtHostInteractiveShape;

	private readonly _disposables = new DisposableStore();

	constructor(
		extHostContext: IExtHostContext,
		@IInteractiveDocumentService interactiveDocumentService: IInteractiveDocumentService
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostInteractive);

		this._disposables.add(interactiveDocumentService.onWillAddInteractiveDocument((e) => {
			this._proxy.$willAddInteractiveDocument(e.inputUri, '\n', 'plaintext', e.notebookUri);
		}));

		this._disposables.add(interactiveDocumentService.onWillRemoveInteractiveDocument((e) => {
			this._proxy.$willRemoveInteractiveDocument(e.inputUri, e.notebookUri);
		}));
	}

	dispose(): void {
		this._disposables.dispose();

	}
}
