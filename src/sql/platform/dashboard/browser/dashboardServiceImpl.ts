/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDashboardService } from './dashboardService';
import { Event, Emitter } from 'vs/base/common/event';
import * as DOM from 'vs/base/browser/dom';
import * as azdata from 'azdata';

export class DashboardService implements IDashboardService {
	public _serviceBrand: undefined;
	private _onDidOpenDashboard = new Emitter<azdata.DashboardDocument>();
	public readonly onDidOpenDashboard: Event<azdata.DashboardDocument> = this._onDidOpenDashboard.event;

	private _onDidChangeToDashboard = new Emitter<azdata.DashboardDocument>();
	public readonly onDidChangeToDashboard: Event<azdata.DashboardDocument> = this._onDidChangeToDashboard.event;

	private _onLayout = new Emitter<DOM.Dimension>();
	public readonly onLayout: Event<DOM.Dimension> = this._onLayout.event;

	public openDashboard(document: azdata.DashboardDocument): void {
		this._onDidOpenDashboard.fire(document);
	}

	public changeToDashboard(document: azdata.DashboardDocument): void {
		this._onDidChangeToDashboard.fire(document);
	}

	public layout(dimension: DOM.Dimension): void {
		this._onLayout.fire(dimension);
	}
}
