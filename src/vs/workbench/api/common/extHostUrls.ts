/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import { MainContext, IMainContext, ExtHostUrlsShape, MainThreadUrlsShape } from './extHost.protocol';
import { URI, UriComponents } from 'vs/base/common/uri';
import { toDisposable } from 'vs/base/common/lifecycle';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ExtensionIdentifierSet, IExtensionDescription } from 'vs/platform/extensions/common/extensions';

export class ExtHostUrls implements ExtHostUrlsShape {

	private static HandlePool = 0;
	private readonly _proxy: MainThreadUrlsShape;

	private handles = new ExtensionIdentifierSet();
	private handlers = new Map<number, vscode.UriHandler>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadUrls);
	}

	registerUriHandler(extension: IExtensionDescription, handler: vscode.UriHandler): vscode.Disposable {
		const extensionId = extension.identifier;
		if (this.handles.has(extensionId)) {
			throw new Error(`Protocol handler already registered for extension ${extensionId}`);
		}

		const handle = ExtHostUrls.HandlePool++;
		this.handles.add(extensionId);
		this.handlers.set(handle, handler);
		this._proxy.$registerUriHandler(handle, extensionId, extension.displayName || extension.name);

		return toDisposable(() => {
			this.handles.delete(extensionId);
			this.handlers.delete(handle);
			this._proxy.$unregisterUriHandler(handle);
		});
	}

	$handleExternalUri(handle: number, uri: UriComponents): Promise<void> {
		const handler = this.handlers.get(handle);

		if (!handler) {
			return Promise.resolve(undefined);
		}
		try {
			handler.handleUri(URI.revive(uri));
		} catch (err) {
			onUnexpectedError(err);
		}

		return Promise.resolve(undefined);
	}

	async createAppUri(uri: URI): Promise<vscode.Uri> {
		return URI.revive(await this._proxy.$createAppUri(uri));
	}
}
