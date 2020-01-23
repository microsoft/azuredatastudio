/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as Utils from '../utils';
import ControllerBase from './controllerBase';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The main controller class that initializes the extension
 */
export default class MainController extends ControllerBase {
	public deactivate(): void {
		Utils.logDebug('Main controller deactivated');
	}

	public activate(): Promise<boolean> {
		const webviewExampleHtml = fs.readFileSync(path.join(__dirname, 'webviewExample.html')).toString();
		const buttonHtml = fs.readFileSync(path.join(__dirname, 'button.html')).toString();
		const counterHtml = fs.readFileSync(path.join(__dirname, 'counter.html')).toString();

		let countWidget: azdata.DashboardWebview;
		let buttonWidget: azdata.DashboardWebview;
		let count = 0;

		let dialog: azdata.ModalDialog = azdata.window.createWebViewDialog('Flyout extension');
		dialog.html = '<div>This is a flyout extension.</div>';

		azdata.dashboard.registerWebviewProvider('webview-count', e => {
			e.html = counterHtml;
			countWidget = e;
		});
		azdata.dashboard.registerWebviewProvider('webview-button', e => {
			e.html = buttonHtml;
			buttonWidget = e;
			e.onMessage(event => {
				if (event === 'openFlyout') {
					dialog.open();
				} else {
					count++;
					countWidget.postMessage(count);
				}
			});
		});
		azdata.dashboard.registerWebviewProvider('webviewExample', e => {
			e.html = webviewExampleHtml;
		});

		return Promise.resolve(true);
	}
}

