/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDashboardViewService, IDashboardWebview, IDashboardModelView } from 'sql/services/dashboard/common/dashboardViewService';
import Event, { Emitter } from 'vs/base/common/event';

export class DashboardViewService implements IDashboardViewService {
	_serviceBrand: any;

	private _onRegisteredWebview = new Emitter<IDashboardWebview>();
	public readonly onRegisteredWebview: Event<IDashboardWebview> = this._onRegisteredWebview.event;

	private _onRegisteredModelView = new Emitter<IDashboardModelView>();
	public readonly onRegisteredModelView: Event<IDashboardModelView> = this._onRegisteredModelView.event;

	public registerWebview(widget: IDashboardWebview) {
		this._onRegisteredWebview.fire(widget);
	}

	registerModelView(view: IDashboardModelView) {
		this._onRegisteredModelView.fire(view);
	}
}
