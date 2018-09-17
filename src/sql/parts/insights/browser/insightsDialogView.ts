/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!sql/parts/insights/browser/media/insightsDialog';

import { Button } from 'sql/base/browser/ui/button/button';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { Modal } from 'sql/base/browser/ui/modal/modal';
import { IInsightsConfigDetails } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { attachButtonStyler, attachModalDialogStyler, attachTableStyler } from 'sql/common/theme/styler';
import { TaskRegistry } from 'sql/platform/tasks/common/tasks';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { IInsightsDialogModel, ListResource, IInsightDialogActionContext, insertValueRegex } from 'sql/parts/insights/common/interfaces';
import { TableCollapsibleView } from 'sql/base/browser/ui/table/tableView';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';
import { error } from 'sql/base/common/log';
import { Table } from 'sql/base/browser/ui/table/table';
import { CopyInsightDialogSelectionAction } from 'sql/parts/insights/common/insightDialogActions';
import { SplitView, ViewSizing } from 'sql/base/browser/ui/splitview/splitview';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import * as DOM from 'vs/base/browser/dom';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IListService } from 'vs/platform/list/browser/listService';
import * as nls from 'vs/nls';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAction } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as types from 'vs/base/common/types';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { MenuRegistry, ExecuteCommandAction } from 'vs/platform/actions/common/actions';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';

const labelDisplay = nls.localize("insights.item", "Item");
const valueDisplay = nls.localize("insights.value", "Value");

function stateFormatter(row: number, cell: number, value: any, columnDef: Slick.Column<ListResource>, resource: ListResource): string {
	// template
	const icon = DOM.$('span.icon-span');
	const badge = DOM.$('div.badge');
	const badgeContent = DOM.$('div.badge-content');
	DOM.append(badge, badgeContent);
	DOM.append(icon, badge);

	// render icon if passed
	if (resource.icon) {
		icon.classList.add('icon');
		icon.classList.add(resource.icon);
	} else {
		icon.classList.remove('icon');
	}

	//render state badge if present
	if (resource.stateColor) {
		badgeContent.style.backgroundColor = resource.stateColor;
		badgeContent.classList.remove('icon');
	} else if (resource.stateIcon) {
		badgeContent.style.backgroundColor = '';
		badgeContent.classList.add('icon');
		badgeContent.classList.add(resource.stateIcon);
	} else {
		badgeContent.classList.remove('icon');
		badgeContent.style.backgroundColor = '';
	}

	return icon.outerHTML;
}

export class InsightsDialogView extends Modal {

	private _table
	private _connectionProfile: IConnectionProfile;
	private _insight: IInsightsConfigDetails;
	private _splitView: SplitView;
	private _container: HTMLElement;
	private _closeButton: Button;
	private _topTable: Table<ListResource>;
	private _topTableData: TableDataView<ListResource>;
	private _bottomTable: Table<ListResource>;
	private _bottomTableData: TableDataView<ListResource>;
	private _taskButtonDisposables: IDisposable[] = [];
	private _topColumns: Array<Slick.Column<ListResource>> = [
		{
			name: '',
			field: 'state',
			id: 'state',
			width: 20,
			resizable: false,
			formatter: stateFormatter
		},
		{
			name: labelDisplay,
			field: 'label',
			id: 'label'
		},
		{
			name: valueDisplay,
			field: 'value',
			id: 'value'
		}
	];

	private _bottomColumns: Array<Slick.Column<ListResource>> = [
		{
			name: nls.localize("property", "Property"),
			field: 'label',
			id: 'label'
		},
		{
			name: nls.localize("value", "Value"),
			field: 'value',
			id: 'value'
		}
	];

	constructor(
		private _model: IInsightsDialogModel,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IThemeService private _themeService: IThemeService,
		@IListService private _listService: IListService,
		@IPartService partService: IPartService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ICommandService private _commandService: ICommandService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService
	) {
		super(nls.localize("InsightsDialogTitle", "Insights"), TelemetryKeys.Insights, partService, telemetryService, contextKeyService);
		this._model.onDataChange(e => this.build());
	}

	private updateTopColumns(): void {
		let labelName = this.labelColumnName ? this.labelColumnName : labelDisplay;
		let valueName = this._insight.value ? this._insight.value : valueDisplay;
		this._topColumns = [
			{
				name: '',
				field: 'state',
				id: 'state',
				width: 20,
				resizable: false,
				formatter: stateFormatter
			},
			{
				name: labelName,
				field: 'label',
				id: 'label'
			},
			{
				name: valueName,
				field: 'value',
				id: 'value'
			}
		];
		this._topTable.columns = this._topColumns;
	}

	protected renderBody(container: HTMLElement) {
		this._container = container;

		this._splitView = new SplitView(container);

		const itemsHeaderTitle = nls.localize("insights.dialog.items", "Items");
		const itemsDetailHeaderTitle = nls.localize("insights.dialog.itemDetails", "Item Details");

		this._topTableData = new TableDataView();
		this._bottomTableData = new TableDataView();
		let topTableView = new TableCollapsibleView(itemsHeaderTitle, { sizing: ViewSizing.Flexible, ariaHeaderLabel: itemsHeaderTitle }, this._topTableData, this._topColumns, { forceFitColumns: true });
		this._topTable = topTableView.table;
		topTableView.addContainerClass('insights');
		this._topTable.setSelectionModel(new RowSelectionModel<ListResource>());
		let bottomTableView = new TableCollapsibleView(itemsDetailHeaderTitle, { sizing: ViewSizing.Flexible, ariaHeaderLabel: itemsDetailHeaderTitle }, this._bottomTableData, this._bottomColumns, { forceFitColumns: true });
		this._bottomTable = bottomTableView.table;
		this._bottomTable.setSelectionModel(new RowSelectionModel<ListResource>());

		this._register(this._topTable.onSelectedRowsChanged((e: DOMEvent, data: Slick.OnSelectedRowsChangedEventArgs<ListResource>) => {
			if (data.rows.length === 1) {
				let element = this._topTableData.getItem(data.rows[0]);
				let resourceArray: ListResource[] = [];
				for (let i = 0; i < this._model.columns.length; i++) {
					resourceArray.push({ label: this._model.columns[i], value: element.data[i], data: element.data });
				}

				this._bottomTableData.clear();
				this._bottomTableData.push(resourceArray);
				if (bottomTableView.isExpanded()) {
					bottomTableView.collapse();
					bottomTableView.expand();
				}
				this._enableTaskButtons(true);
			} else {
				this._enableTaskButtons(false);
			}
		}));

		this._register(this._topTable.onContextMenu(e => {
			if (this.hasActions()) {
				this._contextMenuService.showContextMenu({
					getAnchor: () => e.anchor,
					getActions: () => this.insightActions,
					getActionsContext: () => this.topInsightContext(this._topTableData.getItem(e.cell.row))
				});
			}
		}));

		this._register(this._bottomTable.onContextMenu(e => {
			this._contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => TPromise.as([this._instantiationService.createInstance(CopyInsightDialogSelectionAction, CopyInsightDialogSelectionAction.ID, CopyInsightDialogSelectionAction.LABEL)]),
				getActionsContext: () => this.bottomInsightContext(this._bottomTableData.getItem(e.cell.row), e.cell)
			});
		}));

		this._splitView.addView(topTableView);
		this._splitView.addView(bottomTableView);

		this._register(attachTableStyler(this._topTable, this._themeService));
		this._register(attachTableStyler(this._bottomTable, this._themeService));

		this._topTable.grid.onKeyDown.subscribe((e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				topTableView.focus();
				e.stopImmediatePropagation();
			} else if (event.equals(KeyCode.Tab)) {
				bottomTableView.focus();
				e.stopImmediatePropagation();
			}
		});

		this._bottomTable.grid.onKeyDown.subscribe((e: KeyboardEvent) => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyMod.Shift | KeyCode.Tab)) {
				bottomTableView.focus();
				e.stopImmediatePropagation();
			} else if (event.equals(KeyCode.Tab)) {
				let buttonFound = false;
				for (let index = 0; index < this._taskButtonDisposables.length; index++) {
					let element = this._taskButtonDisposables[index];
					if (element instanceof Button && element.enabled) {
						buttonFound = true;
						element.focus();
						break;
					}
				}
				if (!buttonFound) {
					this._closeButton.focus();
				}
				e.stopImmediatePropagation();
			}
		});
	}

	public render() {
		super.render();
		this._closeButton = this.addFooterButton('Close', () => this.close());
		this._register(attachButtonStyler(this._closeButton, this._themeService));
		this._register(attachModalDialogStyler(this, this._themeService));
	}

	protected layout(height?: number): void {
		this._splitView.layout(DOM.getContentHeight(this._container));
	}

	// insight object
	public open(input: IInsightsConfigDetails, connectionProfile: IConnectionProfile): void {
		if (types.isUndefinedOrNull(input) || types.isUndefinedOrNull(connectionProfile)) {
			return;
		}
		this._insight = input;
		this._connectionProfile = connectionProfile;
		this.updateTopColumns();
		this.show();
	}

	private build(): void {
		let labelIndex: number;
		let valueIndex: number;
		let columnName = this.labelColumnName;
		if (this._insight.label === undefined || (labelIndex = this._model.columns.indexOf(columnName)) === -1) {
			labelIndex = 0;
		}
		if (this._insight.value === undefined || (valueIndex = this._model.columns.indexOf(this._insight.value)) === -1) {
			valueIndex = 1;
		}
		// convert
		let inputArray = this._model.getListResources(labelIndex, valueIndex);
		this._topTableData.clear();
		this._topTableData.push(inputArray);
		if (this._insight.actions && this._insight.actions.types) {
			let tasks = TaskRegistry.getTasks();
			for (let action of this._insight.actions.types) {
				let task = tasks.includes(action);
				let commandAction = MenuRegistry.getCommand(action);
				let commandLabel = types.isString(commandAction.title) ? commandAction.title : commandAction.title.value;
				if (task && !this.findFooterButton(commandLabel)) {
					let button = this.addFooterButton(commandLabel, () => {
						let element = this._topTable.getSelectedRows();
						let resource: ListResource;
						if (element && element.length > 0) {
							resource = this._topTableData.getItem(element[0]);
						} else {
							return;
						}
						let context = this.topInsightContext(resource);
						this._commandService.executeCommand(action, context);
					}, 'left');
					button.enabled = false;
					this._taskButtonDisposables.push(button);
					this._taskButtonDisposables.push(attachButtonStyler(button, this._themeService));
				}
			}
		}
		this.layout();

		// Select and focus the top row
		this._topTable.grid.gotoCell(0, 1);
	}

	public reset(): void {
		this._topTableData.clear();
		this._bottomTableData.clear();
	}

	private get labelColumnName(): string {
		return typeof this._insight.label === 'object' ? this._insight.label.column : this._insight.label;
	}


	public close() {
		this.hide();
		dispose(this._taskButtonDisposables);
		this._taskButtonDisposables = [];
		this.dispose();
	}

	protected onClose(e: StandardKeyboardEvent) {
		this.close();
	}

	private hasActions(): boolean {
		return !!(this._insight && this._insight.actions && this._insight.actions.types
			&& this._insight.actions.types.length > 0);
	}

	private get insightActions(): TPromise<IAction[]> {
		let tasks = TaskRegistry.getTasks();
		let actions = this._insight.actions.types;
		let returnActions: IAction[] = [];
		for (let action of actions) {
			let task = tasks.includes(action);
			let commandAction = MenuRegistry.getCommand(action);
			if (task) {
				returnActions.push(this._instantiationService.createInstance(ExecuteCommandAction, commandAction.id, commandAction.title));
			}
		}
		return TPromise.as(returnActions);
	}

	/**
	 * Creates the context that should be passed to the action passed on the selected element for the top table
	 * @param element
	 */
	private topInsightContext(element: ListResource): IConnectionProfile {
		let database = this._insight.actions.database || this._connectionProfile.databaseName;
		let server = this._insight.actions.server || this._connectionProfile.serverName;
		let user = this._insight.actions.user || this._connectionProfile.userName;
		let match: Array<string>;
		match = database.match(insertValueRegex);
		if (match && match.length > 0) {
			let index = this._model.columns.indexOf(match[1]);
			if (index === -1) {
				error('Could not find column', match[1]);
			} else {
				database = database.replace(match[0], element.data[index]);
			}
		}

		match = server.match(insertValueRegex);
		if (match && match.length > 0) {
			let index = this._model.columns.indexOf(match[1]);
			if (index === -1) {
				error('Could not find column', match[1]);
			} else {
				server = server.replace(match[0], element.data[index]);
			}
		}

		match = user.match(insertValueRegex);
		if (match && match.length > 0) {
			let index = this._model.columns.indexOf(match[1]);
			if (index === -1) {
				error('Could not find column', match[1]);
			} else {
				user = user.replace(match[0], element.data[index]);
			}
		}

		let currentProfile = this._connectionProfile as ConnectionProfile;
		let profile = new ConnectionProfile(this._capabilitiesService, currentProfile);
		profile.databaseName = database;
		profile.serverName = server;
		profile.userName = user;

		return profile;
	}

	/**
	 * Creates the context that should be passed to the action passed on the selected element for the bottom table
	 * @param element
	 */
	private bottomInsightContext(element: ListResource, cell: Slick.Cell): IInsightDialogActionContext {

		let cellData = element[this._bottomColumns[cell.cell].id];

		return { profile: undefined, cellData };
	}

	private _enableTaskButtons(val: boolean): void {
		for (let index = 0; index < this._taskButtonDisposables.length; index++) {
			let element = this._taskButtonDisposables[index];
			if (element instanceof Button) {
				element.enabled = val;
			}
		}
	}
}
