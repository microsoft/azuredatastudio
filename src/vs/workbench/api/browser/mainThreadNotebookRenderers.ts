/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ExtHostContext, ExtHostNotebookRenderersShape, IExtHostContext, MainThreadNotebookRenderersShape } from 'vs/workbench/api/common/extHost.protocol'; // {{SQL CARBON EDIT}} Remove MainContext
// import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers'; {{SQL CARBON EDIT}}
import { INotebookRendererMessagingService } from 'vs/workbench/contrib/notebook/common/notebookRendererMessagingService';

// @extHostNamedCustomer(MainContext.MainThreadNotebookRenderers) {{SQL CARBON EDIT}}
export class MainThreadNotebookRenderers extends Disposable implements MainThreadNotebookRenderersShape {
	private readonly proxy: ExtHostNotebookRenderersShape;

	constructor(
		extHostContext: IExtHostContext,
		@INotebookRendererMessagingService private readonly messaging: INotebookRendererMessagingService,
	) {
		super();
		this.proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebookRenderers);
		this._register(messaging.onShouldPostMessage(e => {
			this.proxy.$postRendererMessage(e.editorId, e.rendererId, e.message);
		}));
	}

	$postMessage(editorId: string, rendererId: string, message: unknown): void {
		this.messaging.fireDidReceiveMessage(editorId, rendererId, message);
	}
}
