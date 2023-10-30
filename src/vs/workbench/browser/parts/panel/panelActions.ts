/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/panelpart';
import { localize } from 'vs/nls';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { MenuId, MenuRegistry, registerAction2, Action2, IAction2Options } from 'vs/platform/actions/common/actions';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { IWorkbenchLayoutService, PanelAlignment, Parts, Position, positionToString } from 'vs/workbench/services/layout/browser/layoutService';
import { ActivityAction, ToggleCompositePinnedAction, ICompositeBar } from 'vs/workbench/browser/parts/compositeBarActions';
import { IActivity } from 'vs/workbench/common/activity';
import { AuxiliaryBarVisibleContext, PanelAlignmentContext, PanelMaximizedContext, PanelPositionContext, PanelVisibleContext } from 'vs/workbench/common/contextkeys';
import { ContextKeyExpr, ContextKeyExpression } from 'vs/platform/contextkey/common/contextkey';
import { Codicon } from 'vs/base/common/codicons';
import { registerIcon } from 'vs/platform/theme/common/iconRegistry';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';
import { ViewContainerLocationToString, ViewContainerLocation, IViewDescriptorService, IViewsService } from 'vs/workbench/common/views';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { ICommandActionTitle } from 'vs/platform/action/common/action';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';

const maximizeIcon = registerIcon('panel-maximize', Codicon.chevronUp, localize('maximizeIcon', 'Icon to maximize a panel.'));
const restoreIcon = registerIcon('panel-restore', Codicon.chevronDown, localize('restoreIcon', 'Icon to restore a panel.'));
const closeIcon = registerIcon('panel-close', Codicon.close, localize('closeIcon', 'Icon to close a panel.'));
const panelIcon = registerIcon('panel-layout-icon', Codicon.layoutPanel, localize('togglePanelOffIcon', 'Icon to toggle the panel off when it is on.'));
const panelOffIcon = registerIcon('panel-layout-icon-off', Codicon.layoutPanelOff, localize('togglePanelOnIcon', 'Icon to toggle the panel on when it is off.'));

export class TogglePanelAction extends Action2 {

	static readonly ID = 'workbench.action.togglePanel';
	static readonly LABEL = localize('togglePanelVisibility', "Toggle Panel Visibility");

	constructor() {
		super({
			id: TogglePanelAction.ID,
			title: { value: TogglePanelAction.LABEL, original: 'Toggle Panel Visibility' },
			toggled: {
				condition: PanelVisibleContext,
				title: localize('toggle panel', "Panel"),
				mnemonicTitle: localize({ key: 'toggle panel mnemonic', comment: ['&& denotes a mnemonic'] }, "&&Panel"),
			},
			f1: true,
			category: Categories.View,
			keybinding: { primary: KeyMod.CtrlCmd | KeyCode.KeyJ, weight: KeybindingWeight.WorkbenchContrib },
			menu: [
				{
					id: MenuId.MenubarAppearanceMenu,
					group: '2_workbench_layout',
					order: 5
				}, {
					id: MenuId.LayoutControlMenuSubmenu,
					group: '0_workbench_layout',
					order: 4
				},
			]
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		layoutService.setPartHidden(layoutService.isVisible(Parts.PANEL_PART), Parts.PANEL_PART);
	}
}

registerAction2(TogglePanelAction);

registerAction2(class extends Action2 {

	static readonly ID = 'workbench.action.focusPanel';
	static readonly LABEL = localize('focusPanel', "Focus into Panel");

	constructor() {
		super({
			id: 'workbench.action.focusPanel',
			title: { value: localize('focusPanel', "Focus into Panel"), original: 'Focus into Panel' },
			category: Categories.View,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const paneCompositeService = accessor.get(IPaneCompositePartService);

		// Show panel
		if (!layoutService.isVisible(Parts.PANEL_PART)) {
			layoutService.setPartHidden(false, Parts.PANEL_PART);
		}

		// Focus into active panel
		const panel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
		panel?.focus();
	}
});

const PositionPanelActionId = {
	LEFT: 'workbench.action.positionPanelLeft',
	RIGHT: 'workbench.action.positionPanelRight',
	BOTTOM: 'workbench.action.positionPanelBottom',
};

const AlignPanelActionId = {
	LEFT: 'workbench.action.alignPanelLeft',
	RIGHT: 'workbench.action.alignPanelRight',
	CENTER: 'workbench.action.alignPanelCenter',
	JUSTIFY: 'workbench.action.alignPanelJustify',
};

interface PanelActionConfig<T> {
	id: string;
	when: ContextKeyExpression;
	title: ICommandActionTitle;
	shortLabel: string;
	value: T;
}

function createPanelActionConfig<T>(id: string, title: ICommandActionTitle, shortLabel: string, value: T, when: ContextKeyExpression): PanelActionConfig<T> {
	return {
		id,
		title,
		shortLabel,
		value,
		when,
	};
}

function createPositionPanelActionConfig(id: string, title: ICommandActionTitle, shortLabel: string, position: Position): PanelActionConfig<Position> {
	return createPanelActionConfig<Position>(id, title, shortLabel, position, PanelPositionContext.notEqualsTo(positionToString(position)));
}

function createAlignmentPanelActionConfig(id: string, title: ICommandActionTitle, shortLabel: string, alignment: PanelAlignment): PanelActionConfig<PanelAlignment> {
	return createPanelActionConfig<PanelAlignment>(id, title, shortLabel, alignment, PanelAlignmentContext.notEqualsTo(alignment));
}


const PositionPanelActionConfigs: PanelActionConfig<Position>[] = [
	createPositionPanelActionConfig(PositionPanelActionId.LEFT, { value: localize('positionPanelLeft', 'Move Panel Left'), original: 'Move Panel Left' }, localize('positionPanelLeftShort', "Left"), Position.LEFT),
	createPositionPanelActionConfig(PositionPanelActionId.RIGHT, { value: localize('positionPanelRight', 'Move Panel Right'), original: 'Move Panel Right' }, localize('positionPanelRightShort', "Right"), Position.RIGHT),
	createPositionPanelActionConfig(PositionPanelActionId.BOTTOM, { value: localize('positionPanelBottom', 'Move Panel To Bottom'), original: 'Move Panel To Bottom' }, localize('positionPanelBottomShort', "Bottom"), Position.BOTTOM),
];


const AlignPanelActionConfigs: PanelActionConfig<PanelAlignment>[] = [
	createAlignmentPanelActionConfig(AlignPanelActionId.LEFT, { value: localize('alignPanelLeft', 'Set Panel Alignment to Left'), original: 'Set Panel Alignment to Left' }, localize('alignPanelLeftShort', "Left"), 'left'),
	createAlignmentPanelActionConfig(AlignPanelActionId.RIGHT, { value: localize('alignPanelRight', 'Set Panel Alignment to Right'), original: 'Set Panel Alignment to Right' }, localize('alignPanelRightShort', "Right"), 'right'),
	createAlignmentPanelActionConfig(AlignPanelActionId.CENTER, { value: localize('alignPanelCenter', 'Set Panel Alignment to Center'), original: 'Set Panel Alignment to Center' }, localize('alignPanelCenterShort', "Center"), 'center'),
	createAlignmentPanelActionConfig(AlignPanelActionId.JUSTIFY, { value: localize('alignPanelJustify', 'Set Panel Alignment to Justify'), original: 'Set Panel Alignment to Justify' }, localize('alignPanelJustifyShort', "Justify"), 'justify'),
];



MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.PanelPositionMenu,
	title: localize('positionPanel', "Panel Position"),
	group: '3_workbench_layout_move',
	order: 4
});

PositionPanelActionConfigs.forEach(positionPanelAction => {
	const { id, title, shortLabel, value, when } = positionPanelAction;

	registerAction2(class extends Action2 {
		constructor() {
			super({
				id,
				title,
				category: Categories.View,
				f1: true
			});
		}
		run(accessor: ServicesAccessor): void {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			layoutService.setPanelPosition(value === undefined ? Position.BOTTOM : value);
		}
	});

	MenuRegistry.appendMenuItem(MenuId.PanelPositionMenu, {
		command: {
			id,
			title: shortLabel,
			toggled: when.negate()
		},
		order: 5
	});
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppearanceMenu, {
	submenu: MenuId.PanelAlignmentMenu,
	title: localize('alignPanel', "Align Panel"),
	group: '3_workbench_layout_move',
	order: 5
});

AlignPanelActionConfigs.forEach(alignPanelAction => {
	const { id, title, shortLabel, value, when } = alignPanelAction;
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id,
				title: title,
				category: Categories.View,
				toggled: when.negate(),
				f1: true
			});
		}
		run(accessor: ServicesAccessor): void {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			layoutService.setPanelAlignment(value === undefined ? 'center' : value);
		}
	});

	MenuRegistry.appendMenuItem(MenuId.PanelAlignmentMenu, {
		command: {
			id,
			title: shortLabel,
			toggled: when.negate()
		},
		order: 5
	});
});

export class PanelActivityAction extends ActivityAction {

	constructor(
		activity: IActivity,
		private readonly viewContainerLocation: ViewContainerLocation,
		@IPaneCompositePartService private readonly paneCompositeService: IPaneCompositePartService
	) {
		super(activity);
	}

	override async run(): Promise<void> {
		await this.paneCompositeService.openPaneComposite(this.activity.id, this.viewContainerLocation, true);
		this.activate();
	}

	setActivity(activity: IActivity): void {
		this.activity = activity;
	}
}

export class PlaceHolderPanelActivityAction extends PanelActivityAction {

	constructor(
		id: string,
		viewContainerLocation: ViewContainerLocation,
		@IPaneCompositePartService paneCompositeService: IPaneCompositePartService
	) {
		super({ id, name: id }, viewContainerLocation, paneCompositeService);
	}
}

export class PlaceHolderToggleCompositePinnedAction extends ToggleCompositePinnedAction {

	constructor(id: string, compositeBar: ICompositeBar) {
		super({ id, name: id, classNames: undefined }, compositeBar);
	}

	setActivity(activity: IActivity): void {
		this.label = activity.name;
	}
}

class SwitchPanelViewAction extends Action2 {

	constructor(id: string, title: ICommandActionTitle) {
		super({
			id,
			title,
			category: Categories.View,
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor, offset: number): Promise<void> {
		const paneCompositeService = accessor.get(IPaneCompositePartService);
		const pinnedPanels = paneCompositeService.getPinnedPaneCompositeIds(ViewContainerLocation.Panel);
		const activePanel = paneCompositeService.getActivePaneComposite(ViewContainerLocation.Panel);
		if (!activePanel) {
			return;
		}
		let targetPanelId: string | undefined;
		for (let i = 0; i < pinnedPanels.length; i++) {
			if (pinnedPanels[i] === activePanel.getId()) {
				targetPanelId = pinnedPanels[(i + pinnedPanels.length + offset) % pinnedPanels.length];
				break;
			}
		}
		if (typeof targetPanelId === 'string') {
			await paneCompositeService.openPaneComposite(targetPanelId, ViewContainerLocation.Panel, true);
		}
	}
}

registerAction2(class extends SwitchPanelViewAction {
	constructor() {
		super('workbench.action.previousPanelView', {
			value: localize('previousPanelView', 'Previous Panel View'),
			original: 'Previous Panel View'
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		return super.run(accessor, -1);
	}
});

registerAction2(class extends SwitchPanelViewAction {
	constructor() {
		super('workbench.action.nextPanelView', {
			value: localize('nextPanelView', 'Next Panel View'),
			original: 'Next Panel View'
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		return super.run(accessor, 1);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.toggleMaximizedPanel',
			title: { value: localize('toggleMaximizedPanel', "Toggle Maximized Panel"), original: 'Toggle Maximized Panel' },
			tooltip: localize('maximizePanel', "Maximize Panel Size"),
			category: Categories.View,
			f1: true,
			icon: maximizeIcon,
			// the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
			precondition: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo('center'), PanelPositionContext.notEqualsTo('bottom')),
			toggled: { condition: PanelMaximizedContext, icon: restoreIcon, tooltip: localize('minimizePanel', "Restore Panel Size") },
			menu: [{
				id: MenuId.PanelTitle,
				group: 'navigation',
				order: 1,
				// the workbench grid currently prevents us from supporting panel maximization with non-center panel alignment
				when: ContextKeyExpr.or(PanelAlignmentContext.isEqualTo('center'), PanelPositionContext.notEqualsTo('bottom'))
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const notificationService = accessor.get(INotificationService);
		if (layoutService.getPanelAlignment() !== 'center' && layoutService.getPanelPosition() === Position.BOTTOM) {
			notificationService.warn(localize('panelMaxNotSupported', "Maximizing the panel is only supported when it is center aligned."));
			return;
		}

		if (!layoutService.isVisible(Parts.PANEL_PART)) {
			layoutService.setPartHidden(false, Parts.PANEL_PART);
			// If the panel is not already maximized, maximize it
			if (!layoutService.isPanelMaximized()) {
				layoutService.toggleMaximizedPanel();
			}
		}
		else {
			layoutService.toggleMaximizedPanel();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.closePanel',
			title: { value: localize('closePanel', "Close Panel"), original: 'Close Panel' },
			category: Categories.View,
			icon: closeIcon,
			menu: [{
				id: MenuId.CommandPalette,
				when: PanelVisibleContext,
			}, {
				id: MenuId.PanelTitle,
				group: 'navigation',
				order: 2
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.PANEL_PART);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.closeAuxiliaryBar',
			title: { value: localize('closeSecondarySideBar', "Close Secondary Side Bar"), original: 'Close Secondary Side Bar' },
			category: Categories.View,
			icon: closeIcon,
			menu: [{
				id: MenuId.CommandPalette,
				when: AuxiliaryBarVisibleContext,
			}, {
				id: MenuId.AuxiliaryBarTitle,
				group: 'navigation',
				order: 2
			}]
		});
	}
	run(accessor: ServicesAccessor) {
		accessor.get(IWorkbenchLayoutService).setPartHidden(true, Parts.AUXILIARYBAR_PART);
	}
});

MenuRegistry.appendMenuItems([
	{
		id: MenuId.LayoutControlMenu,
		item: {
			group: '0_workbench_toggles',
			command: {
				id: TogglePanelAction.ID,
				title: localize('togglePanel', "Toggle Panel"),
				icon: panelOffIcon,
				toggled: { condition: PanelVisibleContext, icon: panelIcon }
			},
			when: ContextKeyExpr.or(ContextKeyExpr.equals('config.workbench.layoutControl.type', 'toggles'), ContextKeyExpr.equals('config.workbench.layoutControl.type', 'both')),
			order: 1
		}
	}, {
		id: MenuId.ViewTitleContext,
		item: {
			group: '3_workbench_layout_move',
			command: {
				id: TogglePanelAction.ID,
				title: { value: localize('hidePanel', "Hide Panel"), original: 'Hide Panel' },
			},
			when: ContextKeyExpr.and(PanelVisibleContext, ContextKeyExpr.equals('viewLocation', ViewContainerLocationToString(ViewContainerLocation.Panel))),
			order: 2
		}
	}
]);

class MoveViewsBetweenPanelsAction extends Action2 {
	constructor(private readonly source: ViewContainerLocation, private readonly destination: ViewContainerLocation, desc: Readonly<IAction2Options>) {
		super(desc);
	}

	run(accessor: ServicesAccessor, ...args: any[]): void {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const layoutService = accessor.get(IWorkbenchLayoutService);
		const viewsService = accessor.get(IViewsService);

		const srcContainers = viewDescriptorService.getViewContainersByLocation(this.source);
		const destContainers = viewDescriptorService.getViewContainersByLocation(this.destination);

		if (srcContainers.length) {
			const activeViewContainer = viewsService.getVisibleViewContainer(this.source);

			srcContainers.forEach(viewContainer => viewDescriptorService.moveViewContainerToLocation(viewContainer, this.destination));
			layoutService.setPartHidden(false, this.destination === ViewContainerLocation.Panel ? Parts.PANEL_PART : Parts.AUXILIARYBAR_PART);

			if (activeViewContainer && destContainers.length === 0) {
				viewsService.openViewContainer(activeViewContainer.id, true);
			}
		}
	}
}

// --- Move Panel Views To Secondary Side Bar

class MovePanelToSidePanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.movePanelToSidePanel';
	constructor() {
		super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
			id: MovePanelToSidePanelAction.ID,
			title: {
				value: localize('movePanelToSecondarySideBar', "Move Panel Views To Secondary Side Bar"),
				original: 'Move Panel Views To Secondary Side Bar'
			},
			category: Categories.View,
			f1: false
		});
	}
}

export class MovePanelToSecondarySideBarAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.movePanelToSecondarySideBar';
	constructor() {
		super(ViewContainerLocation.Panel, ViewContainerLocation.AuxiliaryBar, {
			id: MovePanelToSecondarySideBarAction.ID,
			title: {
				value: localize('movePanelToSecondarySideBar', "Move Panel Views To Secondary Side Bar"),
				original: 'Move Panel Views To Secondary Side Bar'
			},
			category: Categories.View,
			f1: true
		});
	}
}

registerAction2(MovePanelToSidePanelAction);
registerAction2(MovePanelToSecondarySideBarAction);

// --- Move Secondary Side Bar Views To Panel

class MoveSidePanelToPanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.moveSidePanelToPanel';

	constructor() {
		super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
			id: MoveSidePanelToPanelAction.ID,
			title: {
				value: localize('moveSidePanelToPanel', "Move Secondary Side Bar Views To Panel"),
				original: 'Move Secondary Side Bar Views To Panel'
			},
			category: Categories.View,
			f1: false
		});
	}
}

export class MoveSecondarySideBarToPanelAction extends MoveViewsBetweenPanelsAction {
	static readonly ID = 'workbench.action.moveSecondarySideBarToPanel';

	constructor() {
		super(ViewContainerLocation.AuxiliaryBar, ViewContainerLocation.Panel, {
			id: MoveSecondarySideBarToPanelAction.ID,
			title: {
				value: localize('moveSidePanelToPanel', "Move Secondary Side Bar Views To Panel"),
				original: 'Move Secondary Side Bar Views To Panel'
			},
			category: Categories.View,
			f1: true
		});
	}
}
registerAction2(MoveSidePanelToPanelAction);
registerAction2(MoveSecondarySideBarToPanelAction);
