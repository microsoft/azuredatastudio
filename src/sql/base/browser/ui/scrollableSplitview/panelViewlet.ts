/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./panelviewlet';

import { Panel } from 'sql/base/browser/ui/scrollableSplitview/panel';
import { IView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';

import { Emitter, Event, filterEvent } from 'vs/base/common/event';
import { IActionRunner, IAction, IActionItem } from 'vs/base/common/actions';
import { ToolBar } from 'vs/base/browser/ui/toolbar/toolbar';
import { IViewletPanelOptions } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TPromise } from 'vs/base/common/winjs.base';
import { trackFocus, append, $, toggleClass } from 'vs/base/browser/dom';
import { ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import { localize } from 'vs/nls';
import { prepareActions } from 'vs/workbench/browser/actions';

export abstract class ViewletPanel extends Panel implements IView {

	private static AlwaysShowActionsConfig = 'workbench.view.alwaysShowHeaderActions';

	private _onDidFocus = new Emitter<void>();
	readonly onDidFocus: Event<void> = this._onDidFocus.event;

	private _onDidBlur = new Emitter<void>();
	readonly onDidBlur: Event<void> = this._onDidBlur.event;

	protected _onDidChangeTitleArea = new Emitter<void>();
	readonly onDidChangeTitleArea: Event<void> = this._onDidChangeTitleArea.event;

	private _isVisible: boolean;
	readonly id: string;
	readonly title: string;

	protected actionRunner: IActionRunner;
	protected toolbar: ToolBar;
	private headerContainer: HTMLElement;

	constructor(
		options: IViewletPanelOptions,
		@IKeybindingService protected keybindingService: IKeybindingService,
		@IContextMenuService protected contextMenuService: IContextMenuService,
		@IConfigurationService protected readonly configurationService: IConfigurationService
	) {
		super(options);

		this.id = options.id;
		this.title = options.title;
		this.actionRunner = options.actionRunner;
	}

	setVisible(visible: boolean): TPromise<void> {
		if (this._isVisible !== visible) {
			this._isVisible = visible;
		}

		return TPromise.wrap(null);
	}

	isVisible(): boolean {
		return this._isVisible;
	}

	render(container: HTMLElement): void {
		super.render(container);

		const focusTracker = trackFocus(this.element);
		this.disposables.push(focusTracker);
		this.disposables.push(focusTracker.onDidFocus(() => this._onDidFocus.fire()));
		this.disposables.push(focusTracker.onDidBlur(() => this._onDidBlur.fire()));
	}

	protected renderHeader(container: HTMLElement): void {
		this.headerContainer = container;

		this.renderHeaderTitle(container, this.title);

		const actions = append(container, $('.actions'));
		this.toolbar = new ToolBar(actions, this.contextMenuService, {
			orientation: ActionsOrientation.HORIZONTAL,
			actionItemProvider: action => this.getActionItem(action),
			ariaLabel: localize('viewToolbarAriaLabel', "{0} actions", this.title),
			getKeyBinding: action => this.keybindingService.lookupKeybinding(action.id),
			actionRunner: this.actionRunner
		});

		this.disposables.push(this.toolbar);
		this.setActions();

		const onDidRelevantConfigurationChange = filterEvent(this.configurationService.onDidChangeConfiguration, e => e.affectsConfiguration(ViewletPanel.AlwaysShowActionsConfig));
		onDidRelevantConfigurationChange(this.updateActionsVisibility, this, this.disposables);
		this.updateActionsVisibility();
	}

	protected renderHeaderTitle(container: HTMLElement, title: string): void {
		append(container, $('h3.title', null, title));
	}

	focus(): void {
		if (this.element) {
			this.element.focus();
			this._onDidFocus.fire();
		}
	}

	private setActions(): void {
		this.toolbar.setActions(prepareActions(this.getActions()), prepareActions(this.getSecondaryActions()))();
		this.toolbar.context = this.getActionsContext();
	}

	private updateActionsVisibility(): void {
		const shouldAlwaysShowActions = this.configurationService.getValue<boolean>('workbench.view.alwaysShowHeaderActions');
		toggleClass(this.headerContainer, 'actions-always-visible', shouldAlwaysShowActions);
	}

	protected updateActions(): void {
		this.setActions();
		this._onDidChangeTitleArea.fire();
	}

	getActions(): IAction[] {
		return [];
	}

	getSecondaryActions(): IAction[] {
		return [];
	}

	getActionItem(action: IAction): IActionItem {
		return null;
	}

	getActionsContext(): any {
		return undefined;
	}

	getOptimalWidth(): number {
		return 0;
	}

	shutdown(): void {
	}
}
