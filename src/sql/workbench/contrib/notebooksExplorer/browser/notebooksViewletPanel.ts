/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionViewletPanel';
import * as DOM from 'vs/base/browser/dom';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IAction } from 'vs/base/common/actions';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ViewPane, IViewPaneOptions } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export class NotebookViewletPanel extends ViewPane {

	public static readonly ID = 'notebookExplorer.notebooks';

	private _root: HTMLElement;

	constructor(
		private options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@INotebookService protected notebookService: INotebookService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IOpenerService protected openerService: IOpenerService,
		@IThemeService protected themeService: IThemeService,
		@ILogService protected logService: ILogService,
		@ITelemetryService telemetryService: ITelemetryService,
	) {
		super({ ...(options as IViewPaneOptions) }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, opener, themeService, telemetryService);
	}

	protected renderHeader(container: HTMLElement): void {
		super.renderHeader(container);
	}

	renderHeaderTitle(container: HTMLElement): void {
		super.renderHeaderTitle(container, this.options.title);
	}

	renderBody(container: HTMLElement): void {
		this._root = container;
	}

	layoutBody(size: number): void {
		DOM.toggleClass(this._root, 'narrow', this._root.clientWidth < 300);
	}

	show(): void {
	}

	select(): void {
	}

	showPrevious(): void {
	}

	showPreviousPage(): void {
	}

	showNext(): void {
	}

	showNextPage(): void {
	}

	count(): number {
		return 0;
	}

	public getActions(): IAction[] {
		return [
		];
	}

	public clearSearch() {
	}

	public search(value: string): void {
		if (value) {
			// search code here
		} else {
			this.clearSearch();
		}
	}

	dispose(): void {
		super.dispose();
	}

	focus(): void {
		super.focus();
	}
}
