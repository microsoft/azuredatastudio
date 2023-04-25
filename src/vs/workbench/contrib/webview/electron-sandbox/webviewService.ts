/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWebviewElement } from 'vs/workbench/contrib/webview/browser/webview';
import { WebviewInitInfo } from 'vs/workbench/contrib/webview/browser/webviewElement';
import { WebviewService } from 'vs/workbench/contrib/webview/browser/webviewService';
import { ElectronWebviewElement } from 'vs/workbench/contrib/webview/electron-sandbox/webviewElement';

export class ElectronWebviewService extends WebviewService {

	override createWebviewElement(initInfo: WebviewInitInfo): IWebviewElement {
		const webview = this._instantiationService.createInstance(ElectronWebviewElement, initInfo, this._webviewThemeDataProvider);
		this.registerNewWebview(webview);
		return webview;
	}
}
