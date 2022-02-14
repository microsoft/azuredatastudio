/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { QueryPlanWidgetBase } from 'sql/workbench/contrib/queryplan2/browser/queryPlanWidgetBase';
import { QueryPlan2 } from 'sql/workbench/contrib/queryplan2/browser/queryPlan';
import * as DOM from 'vs/base/browser/dom';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export class CustomZoomWidget extends QueryPlanWidgetBase {
	private _actionBar: ActionBar;
	public customZoomInputBox: InputBox;

	constructor(
		public readonly queryPlanView: QueryPlan2,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IThemeService public readonly themeService: IThemeService,
		@INotificationService public readonly notificationService: INotificationService
	) {
		super(DOM.$('.custom-zoom-view'), 'customZoom');

		// Custom zoom input box
		const zoomValueLabel = localize("qpZoomValueLabel", 'Zoom (percent)');
		this.customZoomInputBox = new InputBox(this.container, this.contextViewService, {
			type: 'number',
			ariaLabel: zoomValueLabel,
			flexibleWidth: false
		});
		attachInputBoxStyler(this.customZoomInputBox, this.themeService);

		const currentZoom = queryPlanView.azdataGraphDiagram.graph.view.getScale() * 100;

		// Setting initial value to graph's current zoom
		this.customZoomInputBox.value = Math.round(currentZoom).toString();

		// Setting up keyboard shortcuts
		const self = this;
		this.customZoomInputBox.element.onkeydown = async (ev) => {
			if (ev.key === 'Enter') {
				await new CustomZoomAction().run(self);
			} else if (ev.key === 'Escape') {
				queryPlanView.planActionView.removeWidget(self);
			}
		};

		// Adding action bar
		this._actionBar = new ActionBar(this.container);
		this._actionBar.context = this;
		this._actionBar.pushAction(new CustomZoomAction(), { label: false, icon: true });
		this._actionBar.pushAction(new CancelZoom(), { label: false, icon: true });
	}

	// Setting initial focus to input box
	public focus() {
		this.customZoomInputBox.focus();
	}
}

export class CustomZoomAction extends Action {
	public static ID = 'qp.customZoomAction';
	public static LABEL = localize('zoomAction', "Zoom (Enter)");

	constructor() {
		super(CustomZoomAction.ID, CustomZoomAction.LABEL, Codicon.zoomOut.classNames);
	}

	public override async run(context: CustomZoomWidget): Promise<void> {
		const newValue = parseInt(context.customZoomInputBox.value);
		if (newValue <= 200 && newValue >= 1) { // Getting max and min zoom values from SSMS
			context.queryPlanView.azdataGraphDiagram.graph.view.setScale(newValue / 100);
			context.queryPlanView.planActionView.removeWidget(context);
		} else {
			context.notificationService.error(
				localize('invalidCustomZoomError', "Select a zoom value between 1 to 200")
			);
		}
	}
}

export class CancelZoom extends Action {
	public static ID = 'qp.cancelCustomZoomAction';
	public static LABEL = localize('cancelCustomZoomAction', "Close (Escape)");

	constructor() {
		super(CancelZoom.ID, CancelZoom.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: CustomZoomWidget): Promise<void> {
		context.queryPlanView.planActionView.removeWidget(context);
	}
}


