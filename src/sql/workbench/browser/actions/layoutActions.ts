/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2 } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingRule } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { FocusedViewContext } from 'vs/workbench/common/contextkeys';
import { IViewDescriptorService, IViewsService, ViewContainerLocation } from 'vs/workbench/common/views';
import { IWorkbenchLayoutService, Parts } from 'vs/workbench/services/layout/browser/layoutService';

// --- Toggle View with Command
export abstract class ToggleViewAction extends Action2 {
	private viewId: string;
	constructor(id: string, labelOrg: string, label: string, keybinding?: Omit<IKeybindingRule, 'id'>) {
		super({
			id: id,
			title: { value: label, original: labelOrg },
			category: 'View',
			f1: true,
			keybinding: keybinding,
		});
		this.viewId = id;
	}

	run(accessor: ServicesAccessor): void {
		const contextKeyService = accessor.get(IContextKeyService);
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const viewsService = accessor.get(IViewsService);
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const focusedViewId = FocusedViewContext.getValue(contextKeyService);

		if (focusedViewId === this.viewId) {
			if (viewDescriptorService.getViewLocationById(this.viewId) === ViewContainerLocation.Sidebar) {
				layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
			} else {
				layoutService.setPartHidden(true, Parts.PANEL_PART);
			}
		} else {
			viewsService.openView(this.viewId, true);
		}
	}
}
