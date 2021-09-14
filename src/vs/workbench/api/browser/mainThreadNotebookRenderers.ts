/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { ExtHostContext, ExtHostNotebookRenderersShape, IExtHostContext, MainContext, MainThreadNotebookRenderersShape } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { INotebookRendererMessagingService } from 'vs/workbench/contrib/notebook/common/notebookRendererMessagingService';

@extHostNamedCustomer(MainContext.MainThreadNotebookRenderers)
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
