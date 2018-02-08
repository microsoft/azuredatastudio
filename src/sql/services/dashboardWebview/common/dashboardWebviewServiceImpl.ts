/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDashboardWebviewService, IDashboardWebview } from 'sql/services/dashboardWebview/common/dashboardWebviewService';
import Event, { Emitter } from 'vs/base/common/event';

export class DashboardWebviewService implements IDashboardWebviewService {
	_serviceBrand: any;

	private _onRegisteredWebview = new Emitter<IDashboardWebview>();
	public readonly onRegisteredWebview: Event<IDashboardWebview> = this._onRegisteredWebview.event;


	public registerWebview(widget: IDashboardWebview) {
		this._onRegisteredWebview.fire(widget);
	}
}
