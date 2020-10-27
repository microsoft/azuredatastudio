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
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { getDataGridFormatter } from 'sql/workbench/services/dataGridProvider/browser/dataGridProviderUtils';

export interface ColumnDefinition extends Slick.Column<azdata.DataGridItem> {
	name: string;
	type: azdata.DataGridColumnType;
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
		@IDataGridProviderService private _dataGridProvider: IDataGridProviderService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService) {
		super();
		this._actionsColumn = new ButtonColumn<azdata.DataGridItem>({
			id: 'actions',
			iconCssClass: 'toggle-more',
			title: nls.localize('resourceViewer.showActions', "Show Actions"),
			sortable: false
		});
		this._register(this._actionsColumn.onClick(args => {
			const actions = args.item.actions.map(commandInfo => instantiationService.createInstance(ResourceViewerCommandAction, commandInfo.id, commandInfo.displayText, commandInfo.args));
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
		const columns = await this._dataGridProvider.getDataGridColumns(this._providerId);
		this.columns = columns.map(col => {
			if (col.type === 'actions') {
				const def = this._actionsColumn.definition as ColumnDefinition;
				def.type = 'actions';
				def.filterable = false;
				return def;
			}
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
	}

	private async fetchItems(): Promise<void> {
		const items = await this._dataGridProvider.getDataGridItems(this._providerId);
		this._data = items;
		this._onDataChanged.fire();
	}
}

class ResourceViewerCommandAction extends ExecuteCommandAction {
	constructor(id: string, label: string, private _args: any[], @ICommandService commandService: ICommandService) {
		super(id, label, commandService);
	}

	run(): Promise<any> {
		return super.run(...this._args);
	}
}
