/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { protocol } from 'electron';
import { Disposable } from 'vs/base/common/lifecycle';
import { FileAccess, Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';


export class WebviewProtocolProvider extends Disposable {

	private static validWebviewFilePaths = new Map([
		['/index.html', 'index.html'],
		['/fake.html', 'fake.html'],
		['/main.js', 'main.js'],
		['/service-worker.js', 'service-worker.js'],
	]);

	constructor() {
		super();

		// Register the protocol for loading webview html
		const webviewHandler = this.handleWebviewRequest.bind(this);
		protocol.registerFileProtocol(Schemas.vscodeWebview, webviewHandler);
	}

	private handleWebviewRequest(
		request: Electron.ProtocolRequest,
		callback: (response: string | Electron.ProtocolResponse) => void
	) {
		try {
			const uri = URI.parse(request.url);
			const entry = WebviewProtocolProvider.validWebviewFilePaths.get(uri.path);
			if (typeof entry === 'string') {
				const relativeResourcePath = `vs/workbench/contrib/webview/browser/pre/${entry}`;
				const url = FileAccess.asFileUri(relativeResourcePath, require);
				return callback(decodeURIComponent(url.fsPath));
			} else {
				return callback({ error: -10 /* ACCESS_DENIED - https://cs.chromium.org/chromium/src/net/base/net_error_list.h?l=32 */ });
			}
		} catch {
			// noop
		}
		return callback({ error: -2 /* FAILED - https://cs.chromium.org/chromium/src/net/base/net_error_list.h?l=32 */ });
	}
}
