/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/scm';
import { localize } from 'vs/nls';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPane';
import { append, $ } from 'vs/base/browser/dom';
import { IListVirtualDelegate, IListContextMenuEvent, IListEvent } from 'vs/base/browser/ui/list/list';
import { ISCMRepository, ISCMViewService } from 'vs/workbench/contrib/scm/common/scm';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { WorkbenchList } from 'vs/platform/list/browser/listService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { RepositoryRenderer } from 'vs/workbench/contrib/scm/browser/scmRepositoryRenderer';
import { collectContextMenuActions, getActionViewItemProvider } from 'vs/workbench/contrib/scm/browser/util';
import { Orientation } from 'vs/base/browser/ui/sash/sash';
import { Iterable } from 'vs/base/common/iterator';

class ListDelegate implements IListVirtualDelegate<ISCMRepository> {

	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return RepositoryRenderer.TEMPLATE_ID;
	}
}

export class SCMRepositoriesViewPane extends ViewPane {

	private list!: WorkbenchList<ISCMRepository>;

	constructor(
		options: IViewPaneOptions,
		@ISCMViewService protected scmViewService: ISCMViewService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, telemetryService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const listContainer = append(container, $('.scm-view.scm-repositories-view'));

		const delegate = new ListDelegate();
		const renderer = this.instantiationService.createInstance(RepositoryRenderer, getActionViewItemProvider(this.instantiationService));
		const identityProvider = { getId: (r: ISCMRepository) => r.provider.id };

		this.list = this.instantiationService.createInstance(WorkbenchList, `SCM Main`, listContainer, delegate, [renderer], {
			identityProvider,
			horizontalScrolling: false,
			overrideStyles: {
				listBackground: SIDE_BAR_BACKGROUND
			},
			accessibilityProvider: {
				getAriaLabel(r: ISCMRepository) {
					return r.provider.label;
				},
				getWidgetAriaLabel() {
					return localize('scm', "Source Control Repositories");
				}
			}
		}) as WorkbenchList<ISCMRepository>;

		this._register(this.list);
		this._register(this.list.onDidChangeSelection(this.onListSelectionChange, this));
		this._register(this.list.onContextMenu(this.onListContextMenu, this));

		this._register(this.scmViewService.onDidChangeRepositories(this.onDidChangeRepositories, this));
		this._register(this.scmViewService.onDidChangeVisibleRepositories(this.updateListSelection, this));

		if (this.orientation === Orientation.VERTICAL) {
			this._register(this.configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('scm.repositories.visible')) {
					this.updateBodySize();
				}
			}));
		}

		this.onDidChangeRepositories();
		this.updateListSelection();
	}

	private onDidChangeRepositories(): void {
		this.list.splice(0, this.list.length, this.scmViewService.repositories);
		this.updateBodySize();
	}

	override focus(): void {
		this.list.domFocus();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.list.layout(height, width);
	}

	private updateBodySize(): void {
		if (this.orientation === Orientation.HORIZONTAL) {
			return;
		}

		const visibleCount = this.configurationService.getValue<number>('scm.repositories.visible');
		const empty = this.list.length === 0;
		const size = Math.min(this.list.length, visibleCount) * 22;

		this.minimumBodySize = visibleCount === 0 ? 22 : size;
		this.maximumBodySize = visibleCount === 0 ? Number.POSITIVE_INFINITY : empty ? Number.POSITIVE_INFINITY : size;
	}

	private onListContextMenu(e: IListContextMenuEvent<ISCMRepository>): void {
		if (!e.element) {
			return;
		}

		const provider = e.element.provider;
		const menus = this.scmViewService.menus.getRepositoryMenus(provider);
		const menu = menus.repositoryMenu;
		const actions = collectContextMenuActions(menu);

		this.contextMenuService.showContextMenu({
			getAnchor: () => e.anchor,
			getActions: () => actions,
			getActionsContext: () => provider
		});
	}

	private onListSelectionChange(e: IListEvent<ISCMRepository>): void {
		if (e.browserEvent && e.elements.length > 0) {
			const scrollTop = this.list.scrollTop;
			this.scmViewService.visibleRepositories = e.elements;
			this.list.scrollTop = scrollTop;
		}
	}

	private updateListSelection(): void {
		const oldSelection = this.list.getSelection();
		const oldSet = new Set(Iterable.map(oldSelection, i => this.list.element(i)));
		const set = new Set(this.scmViewService.visibleRepositories);
		const added = new Set(Iterable.filter(set, r => !oldSet.has(r)));
		const removed = new Set(Iterable.filter(oldSet, r => !set.has(r)));

		if (added.size === 0 && removed.size === 0) {
			return;
		}

		const selection = oldSelection
			.filter(i => !removed.has(this.list.element(i)));

		for (let i = 0; i < this.list.length; i++) {
			if (added.has(this.list.element(i))) {
				selection.push(i);
			}
		}

		this.list.setSelection(selection);

		if (selection.length > 0 && selection.indexOf(this.list.getFocus()[0]) === -1) {
			this.list.setAnchor(selection[0]);
			this.list.setFocus([selection[0]]);
		}
	}
}
