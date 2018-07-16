/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Delayer } from 'vs/base/common/async';
import * as DOM from 'vs/base/browser/dom';
import * as lifecycle from 'vs/base/common/lifecycle';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction, Action } from 'vs/base/common/actions';
import { BaseActionItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import Messages from 'vs/workbench/parts/markers/common/messages';
import Constants from 'vs/workbench/parts/markers/common/constants';
import { MarkersPanel } from 'vs/workbench/parts/markers/browser/markersPanel';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { CollapseAllAction as TreeCollapseAction } from 'vs/base/parts/tree/browser/treeDefaults';
import Tree = require('vs/base/parts/tree/browser/tree');
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IMarkersWorkbenchService } from 'vs/workbench/parts/markers/common/markers';

export class ToggleMarkersPanelAction extends TogglePanelAction {

	public static readonly ID = 'workbench.actions.view.problems';
	public static readonly LABEL = Messages.MARKERS_PANEL_TOGGLE_LABEL;

	constructor(id: string, label: string,
		@IPartService partService: IPartService,
		@IPanelService panelService: IPanelService,
	) {
		super(id, label, Constants.MARKERS_PANEL_ID, panelService, partService);
	}
}

export class ShowProblemsPanelAction extends Action {

	public static readonly ID = 'workbench.action.problems.focus';
	public static readonly LABEL = Messages.MARKERS_PANEL_SHOW_LABEL;

	constructor(id: string, label: string,
		@IPanelService private panelService: IPanelService
	) {
		super(id, label);
	}

	public run(): TPromise<any> {
		return this.panelService.openPanel(Constants.MARKERS_PANEL_ID, true);
	}
}

export class CollapseAllAction extends TreeCollapseAction {

	constructor(viewer: Tree.ITree, enabled: boolean) {
		super(viewer, enabled);
	}
}

export class FilterAction extends Action {

	public static readonly ID: string = 'workbench.actions.problems.filter';

	constructor() {
		super(FilterAction.ID, Messages.MARKERS_PANEL_ACTION_TOOLTIP_FILTER, 'markers-panel-action-filter', true);
	}

}

export class FilterInputBoxActionItem extends BaseActionItem {

	protected toDispose: lifecycle.IDisposable[];

	private delayedFilterUpdate: Delayer<void>;

	constructor(private markersPanel: MarkersPanel, action: IAction,
		@IContextViewService private contextViewService: IContextViewService,
		@IThemeService private themeService: IThemeService,
		@IMarkersWorkbenchService private markersWorkbenchService: IMarkersWorkbenchService,
		@ITelemetryService private telemetryService: ITelemetryService) {
		super(markersPanel, action);
		this.toDispose = [];
		this.delayedFilterUpdate = new Delayer<void>(500);
	}

	public render(container: HTMLElement): void {
		DOM.addClass(container, 'markers-panel-action-filter');
		let filterInputBox = new InputBox(container, this.contextViewService, {
			placeholder: Messages.MARKERS_PANEL_FILTER_PLACEHOLDER,
			ariaLabel: Messages.MARKERS_PANEL_FILTER_PLACEHOLDER
		});
		this.toDispose.push(attachInputBoxStyler(filterInputBox, this.themeService));
		filterInputBox.value = this.markersWorkbenchService.markersModel.filterOptions.completeFilter;
		this.toDispose.push(filterInputBox.onDidChange(filter => this.delayedFilterUpdate.trigger(() => this.updateFilter(filter))));
		this.toDispose.push(DOM.addStandardDisposableListener(filterInputBox.inputElement, 'keyup', (keyboardEvent) => this.onInputKeyUp(keyboardEvent, filterInputBox)));
		this.toDispose.push(DOM.addStandardDisposableListener(container, 'keydown', this.handleKeyboardEvent));
		this.toDispose.push(DOM.addStandardDisposableListener(container, 'keyup', this.handleKeyboardEvent));
	}

	private updateFilter(filter: string) {
		this.markersPanel.updateFilter(filter);
		this.reportFilteringUsed();
	}

	private reportFilteringUsed(): void {
		let data = {};
		data['errors'] = this.markersWorkbenchService.markersModel.filterOptions.filterErrors;
		data['warnings'] = this.markersWorkbenchService.markersModel.filterOptions.filterWarnings;
		data['infos'] = this.markersWorkbenchService.markersModel.filterOptions.filterInfos;
		/* __GDPR__
			"problems.filter" : {
				"errors" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
				"warnings": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
				"infos": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		this.telemetryService.publicLog('problems.filter', data);
	}

	public dispose(): void {
		this.toDispose = lifecycle.dispose(this.toDispose);
		super.dispose();
	}

	// Action toolbar is swallowing some keys for action items which should not be for an input box
	private handleKeyboardEvent(e: IKeyboardEvent) {
		switch (e.keyCode) {
			case KeyCode.Space:
			case KeyCode.LeftArrow:
			case KeyCode.RightArrow:
			case KeyCode.Escape:
				e.stopPropagation();
				break;
		}
	}

	private onInputKeyUp(keyboardEvent: IKeyboardEvent, filterInputBox: InputBox) {
		switch (keyboardEvent.keyCode) {
			case KeyCode.Escape:
				filterInputBox.value = '';
				return;
			default:
				return;
		}
	}
}