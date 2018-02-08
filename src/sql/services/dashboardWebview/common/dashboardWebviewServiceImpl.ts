/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDashboardWebviewService, IWebviewWidget } from 'sql/services/dashboardWebview/common/dashboardWebviewService';
import Event, { Emitter } from 'vs/base/common/event';

export class DashboardWebviewService implements IDashboardWebviewService {
	_serviceBrand: any;

	private _onRegisteredWidget = new Emitter<IWebviewWidget>();
	public readonly onRegisteredWidget: Event<IWebviewWidget> = this._onRegisteredWidget.event;


	public registerWebviewWidget(widget: IWebviewWidget) {
		this._onRegisteredWidget.fire(widget);
	}
}
