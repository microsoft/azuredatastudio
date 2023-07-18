/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableMap } from 'vs/base/common/lifecycle';
import { IInteractiveEditorBulkEditResponse, IInteractiveEditorResponse, IInteractiveEditorService } from 'vs/workbench/contrib/interactiveEditor/common/interactiveEditor';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { reviveWorkspaceEditDto } from 'vs/workbench/api/browser/mainThreadBulkEdits';
import { ExtHostContext, ExtHostInteractiveEditorShape, MainContext, MainThreadInteractiveEditorShape } from 'vs/workbench/api/common/extHost.protocol';
import { IExtHostContext, extHostNamedCustomer } from 'vs/workbench/services/extensions/common/extHostCustomers';

@extHostNamedCustomer(MainContext.MainThreadInteractiveEditor)
export class MainThreadInteractiveEditor implements MainThreadInteractiveEditorShape {

	private readonly _registrations = new DisposableMap<number>();
	private readonly _proxy: ExtHostInteractiveEditorShape;

	constructor(
		extHostContext: IExtHostContext,
		@IInteractiveEditorService private readonly _interactiveEditorService: IInteractiveEditorService,
		@IUriIdentityService private readonly _uriIdentService: IUriIdentityService,
	) {
		this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostInteractiveEditor);
	}

	dispose(): void {
		this._registrations.dispose();
	}

	async $registerInteractiveEditorProvider(handle: number, debugName: string, supportsFeedback: boolean): Promise<void> {
		const unreg = this._interactiveEditorService.addProvider({
			debugName,
			prepareInteractiveEditorSession: async (model, range, token) => {
				const session = await this._proxy.$prepareInteractiveSession(handle, model.uri, range, token);
				if (!session) {
					return undefined;
				}
				return {
					...session,
					dispose: () => {
						this._proxy.$releaseSession(handle, session.id);
					}
				};
			},
			provideResponse: async (item, request, token) => {
				const result = await this._proxy.$provideResponse(handle, item, request, token);
				if (result?.type === 'bulkEdit') {
					(<IInteractiveEditorBulkEditResponse>result).edits = reviveWorkspaceEditDto(result.edits, this._uriIdentService);
				}
				return <IInteractiveEditorResponse | undefined>result;
			},
			handleInteractiveEditorResponseFeedback: !supportsFeedback ? undefined : async (session, response, kind) => {
				this._proxy.$handleFeedback(handle, session.id, response.id, kind);
			}
		});

		this._registrations.set(handle, unreg);
	}

	async $unregisterInteractiveEditorProvider(handle: number): Promise<void> {
		this._registrations.deleteAndDispose(handle);
	}
}
