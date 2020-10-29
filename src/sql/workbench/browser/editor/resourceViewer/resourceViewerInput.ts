/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';
import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IDataGridProviderService } from 'sql/workbench/services/dataGridProvider/common/dataGridProviderService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IMenuService, MenuId } from 'vs/platform/actions/common/actions';
import { getDataGridFormatter } from 'sql/workbench/services/dataGridProvider/browser/dataGridProviderUtils';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IAction } from 'vs/base/common/actions';
import { fillInActions } from 'vs/platform/actions/browser/menuEntryActionViewItem';

export interface ColumnDefinition extends Slick.Column<azdata.DataGridItem> {
	name: string;
	// actions is a special internal type for the More Actions column
	type: azdata.DataGridColumnType | 'actions';
	filterable?: boolean;
}

export class ResourceViewerInput extends EditorInput {

	public static ID: string = 'workbench.editorInput.resourceViewerInput';
	private _data: azdata.DataGridItem[] = [];
	private _columns: ColumnDefinition[] = [];
	private _actionsColumn: ButtonColumn<azdata.DataGridItem>;
	private _onColumnsChanged = new Emitter<Slick.Column<azdata.DataGridItem>[]>();
	public onColumnsChanged: Event<Slick.Column<azdata.DataGridItem>[]> = this._onColumnsChanged.event;

	private _onDataChanged = new Emitter<void>();
	public onDataChanged: Event<void> = this._onDataChanged.event;

	constructor(private _providerId: string,
		@IDataGridProviderService private _dataGridProviderService: IDataGridProviderService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IMenuService menuService: IMenuService,
		@IContextKeyService contextKeyService: IContextKeyService) {
		super();
		this._actionsColumn = new ButtonColumn<azdata.DataGridItem>({
			id: 'actions',
			iconCssClass: 'toggle-more',
			title: nls.localize('resourceViewer.showActions', "Show Actions"),
			sortable: false
		});
		this._register(this._actionsColumn.onClick(args => {
			// Create the menu based off of the contributed menu actions. Note that this currently doesn't
			// have any item-level support for action filtering, that can be added to the scoped context as
			// needed in the future
			const scopedContext = contextKeyService.createScoped();
			const menu = menuService.createMenu(MenuId.DataGridItemContext, scopedContext);
			const options = { arg: args.item };
			const groups = menu.getActions(options);
			const actions: IAction[] = [];
			fillInActions(groups, actions, false);
			contextMenuService.showContextMenu({
				getAnchor: () => args.position,
				getActions: () => actions
			}
			);
		}));
		this.refresh().catch(err => onUnexpectedError(err));
	}

	public getTypeId(): string {
		return ResourceViewerInput.ID;
	}

	public getName(): string {
		return nls.localize('resourceViewerInput.resourceViewer', "Resource Viewer");
	}

	public get data(): azdata.DataGridItem[] {
		return this._data;
	}

	public set columns(columns: ColumnDefinition[]) {
		this._columns = columns;
		this._onColumnsChanged.fire(this._columns);
	}

	public get columns(): ColumnDefinition[] {
		return this._columns;
	}

	isDirty(): boolean {
		return false;
	}

	public get resource(): URI | undefined {
		return undefined;
	}

	public async refresh(): Promise<void> {
		await Promise.all([
			this.fetchColumns(),
			this.fetchItems()
		]);
	}

	public get plugins(): Slick.Plugin<azdata.DataGridItem>[] {
		return [this._actionsColumn];
	}

	private async fetchColumns(): Promise<void> {
		const columns = await this._dataGridProviderService.getDataGridColumns(this._providerId);
		const columnDefinitions: ColumnDefinition[] = columns.map(col => {
			return {
				name: col.name,
				field: col.field,
				id: col.id,
				formatter: getDataGridFormatter(col.type),
				sortable: col.sortable ?? true,
				filterable: col.filterable ?? true,
				resizable: col.resizable ?? true,
				tooltip: col.tooltip,
				width: col.width,
				type: col.type
			};
		});

		// Now add in the actions column definition at the end
		const actionsColumnDef: ColumnDefinition = Object.assign({}, this._actionsColumn.definition, { type: 'actions', filterable: false }) as ColumnDefinition;
		columnDefinitions.push(actionsColumnDef);
		this.columns = columnDefinitions;
	}

	private async fetchItems(): Promise<void> {
		const items = await this._dataGridProviderService.getDataGridItems(this._providerId);
		this._data = items;
		this._onDataChanged.fire();
	}
}
