/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDashboardWebviewService } from 'sql/services/dashboardWebview/common/dashboardWebviewService';
import Event, { Emitter } from 'vs/base/common/event';

export class DashboardWebviewService implements IDashboardWebviewService {
	_serviceBrand: any;

	private _onRegisteredProvider = new Emitter<WebviewWidget>();
	public readonly onRegisteredProvider: Event<WebviewWidget> = this._onRegisteredProvider.event;


	public registerWebviewWidget(widget: WebviewWidget) {
		this._onRegisteredProvider.fire(widget);
	}
}
