/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWebviewService, Webview, WebviewContentOptions, WebviewOptions } from 'vs/workbench/contrib/webview/common/webview';

export class NullWebviewService implements IWebviewService {

	_serviceBrand: any;

	createWebview(_options: WebviewOptions, _contentOptions: WebviewContentOptions): Webview {
		throw new Error('not supported');
	}
}
