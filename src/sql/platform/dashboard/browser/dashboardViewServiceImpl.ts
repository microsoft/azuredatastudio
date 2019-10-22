/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDashboardViewService, IDashboardWebview } from 'sql/platform/dashboard/browser/dashboardViewService';
import { Event, Emitter } from 'vs/base/common/event';
import { IModelView } from 'sql/platform/model/browser/modelViewService';

export class DashboardViewService implements IDashboardViewService {
	_serviceBrand: undefined;

	private _onRegisteredWebview = new Emitter<IDashboardWebview>();
	public readonly onRegisteredWebview: Event<IDashboardWebview> = this._onRegisteredWebview.event;

	private _onRegisteredModelView = new Emitter<IModelView>();
	public readonly onRegisteredModelView: Event<IModelView> = this._onRegisteredModelView.event;

	public registerWebview(widget: IDashboardWebview) {
		this._onRegisteredWebview.fire(widget);
	}

	registerModelView(view: IModelView) {
		this._onRegisteredModelView.fire(view);
	}
}
