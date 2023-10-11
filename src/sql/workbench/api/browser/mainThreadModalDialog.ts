/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';

import { WebViewDialog } from 'sql/workbench/contrib/webview/browser/webViewDialog';
import { MainThreadModalDialogShape, ExtHostModalDialogsShape } from 'sql/workbench/api/common/sqlExtHost.protocol';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { extHostNamedCustomer, IExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { SqlExtHostContext, SqlMainContext } from 'vs/workbench/api/common/extHost.protocol';

@extHostNamedCustomer(SqlMainContext.MainThreadModalDialog)
export class MainThreadModalDialog extends Disposable implements MainThreadModalDialogShape {
	private readonly _proxy: ExtHostModalDialogsShape;
	private readonly _dialogs = new Map<number, WebViewDialog>();

	constructor(
		context: IExtHostContext,
		@IInstantiationService private readonly _instantiationService: IInstantiationService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModalDialogs);
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
		dialog.setHeaderTitle(value);
	}

	$setHtml(handle: number, value: string): void {
		const dialog = this._dialogs.get(handle);
		dialog.setHtml(value);
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
