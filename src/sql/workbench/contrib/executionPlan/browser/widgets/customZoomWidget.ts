/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { ActionBar } from 'sql/base/browser/ui/taskbar/actionbar';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { ExecutionPlanWidgetBase } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetBase';
import * as DOM from 'vs/base/browser/dom';
import { Action } from 'vs/base/common/actions';
import { Codicon } from 'vs/base/common/codicons';
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { zoomIconClassNames } from 'sql/workbench/contrib/executionPlan/browser/constants';
import { Button } from 'sql/base/browser/ui/button/button';
import { AzdataGraphView } from 'sql/workbench/contrib/executionPlan/browser/azdataGraphView';
import { ExecutionPlanWidgetController } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetController';

export class CustomZoomWidget extends ExecutionPlanWidgetBase {
	private _actionBar: ActionBar;
	public customZoomInputBox: InputBox;

	constructor(
		public readonly widgetController: ExecutionPlanWidgetController,
		public readonly executionPlanDiagram: AzdataGraphView,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IThemeService public readonly themeService: IThemeService,
		@INotificationService public readonly notificationService: INotificationService
	) {
		super(DOM.$('.custom-zoom-view'), 'customZoom');

		// Custom zoom input box
		const zoomValueLabel = localize("qpZoomValueLabel", 'Zoom (percent)');

		this.customZoomInputBox = this._register(new InputBox(this.container, this.contextViewService, {
			type: 'number',
			ariaLabel: zoomValueLabel,
			flexibleWidth: false
		}));
		this._register(attachInputBoxStyler(this.customZoomInputBox, this.themeService));

		const currentZoom = this.executionPlanDiagram.getZoomLevel();

		// Setting initial value to graph's current zoom
		this.customZoomInputBox.value = Math.round(currentZoom).toString();

		// Setting up keyboard shortcuts
		const self = this;
		this._register(DOM.addDisposableListener(this.customZoomInputBox.element, DOM.EventType.KEY_DOWN, async (ev: KeyboardEvent) => {
			if (ev.key === 'Enter') {
				await this._register(new CustomZoomAction()).run(self);
			} else if (ev.key === 'Escape') {
				this.widgetController.removeWidget(self);
			}
		}));

		const applyButton = this._register(new Button(this.container, {
			title: localize('customZoomApplyButtonTitle', "Apply Zoom")
		}));
		applyButton.setWidth('60px');
		applyButton.label = localize('customZoomApplyButton', "Apply");

		this._register(applyButton.onDidClick(async e => {
			await this._register(new CustomZoomAction()).run(self);
		}));

		// Adding action bar
		this._actionBar = this._register(new ActionBar(this.container));
		this._actionBar.context = this;
		this._actionBar.pushAction(this._register(new CancelZoom()), { label: false, icon: true });
	}

	// Setting initial focus to input box
	public focus() {
		this.customZoomInputBox.focus();
	}
}

export class CustomZoomAction extends Action {
	public static ID = 'qp.customZoomAction';
	public static LABEL = localize('zoomAction', "Zoom");

	constructor() {
		super(CustomZoomAction.ID, CustomZoomAction.LABEL, zoomIconClassNames);
	}

	public override async run(context: CustomZoomWidget): Promise<void> {
		const newValue = parseInt(context.customZoomInputBox.value);
		if (newValue <= 200 && newValue >= 1) { // Getting max and min zoom values from SSMS
			context.executionPlanDiagram.setZoomLevel(newValue);
			context.widgetController.removeWidget(context);
		} else {
			context.notificationService.error(
				localize('invalidCustomZoomError', "Select a zoom value between 1 to 200") // TODO lewissanchez: Ask Aasim about this error message after removing zoom limit.
			);
		}
	}
}

export class CancelZoom extends Action {
	public static ID = 'qp.cancelCustomZoomAction';
	public static LABEL = localize('cancelCustomZoomAction', "Close");

	constructor() {
		super(CancelZoom.ID, CancelZoom.LABEL, Codicon.chromeClose.classNames);
	}

	public override async run(context: CustomZoomWidget): Promise<void> {
		context.widgetController.removeWidget(context);
	}
}


