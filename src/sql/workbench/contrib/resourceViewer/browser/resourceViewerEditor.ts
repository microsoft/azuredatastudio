/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/resourceViewerView';
import * as azdata from 'azdata';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { CancellationToken } from 'vs/base/common/cancellation';
import { IStorageService } from 'vs/platform/storage/common/storage';
import * as DOM from 'vs/base/browser/dom';
import { EditorOptions, IEditorOpenContext } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ResourceViewerInput } from 'sql/workbench/browser/editor/resourceViewer/resourceViewerInput';
import { ResourceViewerTable } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerTable';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { ResourceViewerRefresh } from 'sql/workbench/contrib/resourceViewer/browser/resourceViewerActions';
import { IAction } from 'vs/base/common/actions';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';

export type ContextMenuAnchor = HTMLElement | { x: number; y: number; width?: number; height?: number; };

export class ResourceViewerEditor extends EditorPane {
	public static readonly ID: string = 'workbench.editor.resource-viewer';

	private _container!: HTMLElement;
	private _actionBar!: Taskbar;
	private _resourceViewerTable!: ResourceViewerTable;
	private _inputDisposables = this._register(new DisposableStore());

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IWorkbenchThemeService themeService: IWorkbenchThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IMenuService private _menuService: IMenuService,
		@IContextKeyService private _contextKeyService: IContextKeyService
	) {
		super(ResourceViewerEditor.ID, telemetryService, themeService, storageService);
	}

	protected createEditor(parent: HTMLElement): void {
		this._container = document.createElement('div');
		this._container.className = 'resource-viewer';
		parent.appendChild(this._container);

		const header = this.createHeader();
		const tableContainer = this.createResourceViewerTable();

		this._register(this._resourceViewerTable.onContextMenu(e => {
			this.showContextMenu(e.anchor, e.item);
		}));

		this._container.appendChild(header);
		this._container.appendChild(tableContainer);
	}

	private createHeader(): HTMLElement {
		const header = document.createElement('div');
		header.className = 'resource-viewer-header';
		this._actionBar = this._register(new Taskbar(header));

		const refreshAction = this._register(this._instantiationService.createInstance(ResourceViewerRefresh));
		this._actionBar.setContent([
			{ action: refreshAction }
		]);
		return header;
	}

	private createResourceViewerTable(): HTMLElement {
		let resourceViewerTableContainer = document.createElement('div');
		resourceViewerTableContainer.className = 'resource-viewer-table monaco-editor';
		resourceViewerTableContainer.style.width = '100%';
		resourceViewerTableContainer.style.height = '100%';
		resourceViewerTableContainer.style.position = 'relative';
		this._resourceViewerTable = this._register(this._instantiationService.createInstance(ResourceViewerTable, resourceViewerTableContainer));
		return resourceViewerTableContainer;
	}

	public override get input(): ResourceViewerInput | undefined {
		return this._input as ResourceViewerInput;
	}

	override async setInput(input: ResourceViewerInput, options: EditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		this._resourceViewerTable.title = input.title;

		this._inputDisposables.clear();

		input.plugins.forEach(plugin => {
			this._resourceViewerTable.registerPlugin(plugin);
			this._inputDisposables.add({
				dispose: () => {
					this._resourceViewerTable.unregisterPlugin(plugin);
				}
			});
		});

		this._inputDisposables.add(input.onColumnsChanged(columns => {
			this._resourceViewerTable.columns = columns;
		}));
		this._resourceViewerTable.columns = input.columns;

		this._inputDisposables.add(input.onDataChanged(() => {
			this._resourceViewerTable.data = input.data;
		}));
		this._resourceViewerTable.data = input.data;

		this._inputDisposables.add(input.actionsColumn.onClick(e => {
			this.showContextMenu(e.position, e.item);
		}));

		this._inputDisposables.add(input.onLoadingChanged(loading => {
			this._resourceViewerTable.loading = loading;
		}));
		this._resourceViewerTable.loading = input.loading;

		this._actionBar.context = input;

		this._resourceViewerTable.focus();
	}

	public layout(dimension: DOM.Dimension): void {
		this._resourceViewerTable.layout();
		this._container.style.width = dimension.width + 'px';
		const actionbarHeight = DOM.getTotalHeight(this._actionBar.getContainer());
		this._container.style.height = (dimension.height - actionbarHeight) + 'px';
	}

	private showContextMenu(anchor: ContextMenuAnchor, context: azdata.DataGridItem): void {
		this._contextMenuService.showContextMenu({
			getAnchor: () => anchor,
			getActions: () => this.getMenuActions(context)
		});
	}

	private getMenuActions(context: azdata.DataGridItem): IAction[] {
		// Get the contributed menu action items. Note that this currently doesn't
		// have any item-level support for action filtering, that can be added as needed in the future
		const menu = this._menuService.createMenu(MenuId.DataGridItemContext, this._contextKeyService);
		const options = { arg: context };
		const groups = menu.getActions(options);
		const actions: IAction[] = [];
		fillInActions(groups, actions, false);
		return actions;
	}
}
