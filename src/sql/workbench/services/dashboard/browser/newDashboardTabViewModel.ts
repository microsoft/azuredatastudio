/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';

import { IDashboardTab } from 'sql/workbench/services/dashboard/browser/common/interfaces';
import { find } from 'vs/base/common/arrays';


export interface IDashboardUITab {
	tabConfig: IDashboardTab;
	isOpened?: boolean;
}

/**
 * View model for new dashboard tab
 */
export class NewDashboardTabViewModel {

	// EVENTING ///////////////////////////////////////////////////////
	private _updateTabListEmitter: Emitter<IDashboardUITab[]>;
	public get updateTabListEvent(): Event<IDashboardUITab[]> { return this._updateTabListEmitter.event; }


	constructor() {
		// Create event emitters
		this._updateTabListEmitter = new Emitter<IDashboardUITab[]>();
	}

	public updateDashboardTabs(dashboardTabs: Array<IDashboardTab>, openedTabs: Array<IDashboardTab>) {
		let tabList: IDashboardUITab[] = [];
		dashboardTabs.forEach(tab => {
			tabList.push({ tabConfig: tab });
		});
		openedTabs.forEach(tab => {
			let uiTab = find(tabList, i => i.tabConfig === tab);
			if (uiTab) {
				uiTab.isOpened = true;
			}
		});
		this._updateTabListEmitter.fire(tabList);
	}
}
