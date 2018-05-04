/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { WebViewDialog } from 'sql/base/browser/ui/modal/webViewDialog';

import { MainThreadModalDialogShape, SqlMainContext, SqlExtHostContext, ExtHostModalDialogsShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import 'vs/css!sql/media/icons/common-icons';

@extHostNamedCustomer(SqlMainContext.MainThreadModalDialog)
export class MainThreadModalDialog implements MainThreadModalDialogShape {
	private readonly _proxy: ExtHostModalDialogsShape;
	private readonly _dialogs = new Map<number, WebViewDialog>();

	constructor(
		context: IExtHostContext,
		@IWorkbenchEditorService private readonly _editorService: IWorkbenchEditorService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModalDialogs);
	}

	dispose(): void {
		throw new Error('Method not implemented.');
	}

	$createDialog(handle: number): void {
		const dialog = this._instantiationService.createInstance(WebViewDialog);

		this._dialogs.set(handle, dialog);
		dialog.onMessage(args => {
			this._proxy.$onMessage(handle, args);
		});

		dialog.onClosed(args => {
			this._proxy.$onClosed(handle);
		});
	}

	$disposeDialog(handle: number): void {
		const dialog = this._dialogs.get(handle);
		dialog.close();
	}

	$setTitle(handle: number, value: string): void {
		const dialog = this._dialogs.get(handle);
		dialog.headerTitle = value;
	}

	$setHtml(handle: number, value: string): void {
		const dialog = this._dialogs.get(handle);
		dialog.html = value;
	}

	$show(handle: number): void {
		const dialog = this._dialogs.get(handle);
		dialog.render();
		dialog.open();
	}

	async $sendMessage(handle: number, message: any): Promise<boolean> {
		const dialog = this._dialogs.get(handle);
		dialog.sendMessage(message);
		return Promise.resolve(true);
	}
}
