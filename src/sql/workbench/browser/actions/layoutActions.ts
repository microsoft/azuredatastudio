/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { FocusedViewContext, IViewDescriptorService, IViewsService, ViewContainerLocation } from 'vs/workbench/common/views';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';

// --- Toggle View with Command
export abstract class ToggleViewAction extends Action {

	constructor(
		id: string,
		label: string,
		private readonly viewId: string,
		protected viewsService: IViewsService,
		protected viewDescriptorService: IViewDescriptorService,
		protected contextKeyService: IContextKeyService,
		private layoutService: IWorkbenchLayoutService,
		cssClass?: string
	) {
		super(id, label, cssClass);
	}

	override async run(): Promise<void> {
		const focusedViewId = FocusedViewContext.getValue(this.contextKeyService);

		if (focusedViewId === this.viewId) {
			if (this.viewDescriptorService.getViewLocationById(this.viewId) === ViewContainerLocation.Sidebar) {
				this.layoutService.setSideBarHidden(true);
			} else {
				this.layoutService.setPanelHidden(true);
			}
		} else {
			this.viewsService.openView(this.viewId, true);
		}
	}
}
