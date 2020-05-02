/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/explorerWidget';

import { Component, Inject, forwardRef, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { DashboardWidget, IDashboardWidget, WidgetConfig, WIDGET_CONFIG } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { CommonServiceInterface } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
//import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
//import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { InputBox, IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import * as nls from 'vs/nls';
//import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { Delayer } from 'vs/base/common/async';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { subscriptionToDisposable } from 'sql/base/browser/lifecycle';
import { ObjectMetadataWrapper } from 'sql/workbench/contrib/dashboard/browser/widgets/explorer/objectMetadataWrapper';
import { status, alert } from 'vs/base/browser/ui/aria/aria';
import { isStringArray } from 'vs/base/common/types';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { Table } from 'sql/base/browser/ui/table/table';
import { DatabaseInfo } from 'azdata';
import { getFlavor, ListViewProperty } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { ILogService } from 'vs/platform/log/common/log';
import * as DOM from 'vs/base/browser/dom';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IconColumnDefinition, IconFormatter } from 'sql/base/browser/ui/table/plugins/iconColumn';
import { ButtonColumn } from 'sql/base/browser/ui/table/plugins/buttonColumn.plugin';

const NameProperty: string = 'name';
const NamePropertyDisplayText: string = nls.localize('dashboard.explorer.namePropertyDisplayValue', "Name");
const IconClassProperty: string = 'iconClass';
const IconTitleProperty: string = 'iconTitle';

@Component({
	selector: 'explorer-widget',
	templateUrl: decodeURI(require.toUrl('./explorerWidget.component.html'))
})
export class ExplorerWidget extends DashboardWidget implements IDashboardWidget, OnInit {
	private _input: InputBox;
	private _table: Table<Slick.SlickData>;
	private _filterDelayer = new Delayer<void>(200);
	private _propertyList: ListViewProperty[] = [];
	private _actionsColumn: ButtonColumn<Slick.SlickData>;

	@ViewChild('input') private _inputContainer: ElementRef;
	@ViewChild('table') private _tableContainer: ElementRef;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private readonly _bootstrap: CommonServiceInterface,
		@Inject(WIDGET_CONFIG) protected _config: WidgetConfig,
		@Inject(forwardRef(() => ElementRef)) private readonly _el: ElementRef,
		@Inject(IWorkbenchThemeService) private readonly themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private readonly contextViewService: IContextViewService,
		@Inject(ILogService) private readonly logService: ILogService,
		//@Inject(ICapabilitiesService) private readonly capabilitiesService: ICapabilitiesService,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef
	) {
		super(changeRef);
		this._loadingMessage = this._config.context === 'database' ? nls.localize('loadingObjects', "loading objects") : nls.localize('loadingDatabases', "loading databases");
		this._loadingCompletedMessage = this._config.context === 'database' ? nls.localize('loadingObjectsCompleted', "loading objects completed.") : nls.localize('loadingDatabasesCompleted', "loading databases completed.");
		this.init();
	}

	ngOnInit() {
		this._inited = true;

		const placeholderLabel = this._config.context === 'database' ? nls.localize('seachObjects', "Search by name of type (a:, t:, v:, f:, or sp:)") : nls.localize('searchDatabases', "Search databases");

		const inputOptions: IInputOptions = {
			placeholder: placeholderLabel,
			ariaLabel: placeholderLabel
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
		this._register(this._input.onDidChange(e => {
			this._filterDelayer.trigger(async () => {
				// this._treeFilter.filterString = e;
				// await this._tree.refresh();
				const count = this._table.getData().getLength();
				let message: string;
				if (count === 0) {
					message = nls.localize('explorerSearchNoMatchResultMessage', "No matching item found");
				} else if (count === 1) {
					message = nls.localize('explorerSearchSingleMatchResultMessage', "Filtered search list to 1 item");
				} else {
					message = nls.localize('explorerSearchMatchResultMessage', "Filtered search list to {0} items", count);
				}
				status(message);
			});
		}));
		this._table = new Table(this._tableContainer.nativeElement, undefined, { forceFitColumns: true, rowHeight: 35 });
		this._table.setSelectionModel(new CellSelectionModel());
		this._actionsColumn = new ButtonColumn<Slick.SlickData>({
			id: 'actions',
			iconCssClass: 'toggle-more',
			title: 'show actions',
			width: 40
		});
		this._table.registerPlugin(this._actionsColumn);
		this._register(this._actionsColumn.onClick((item) => {
		}));
		this._register(this._input);
		this._register(attachInputBoxStyler(this._input, this.themeService));
		this._register(this._table);
		this._register(attachTableStyler(this._table, this.themeService));
	}

	private init(): void {
		this.setLoadingStatus(true);
		const serverInfo = this._bootstrap.connectionManagementService.connectionInfo.serverInfo;
		const flavor = getFlavor(serverInfo, this.logService, this._bootstrap.connectionManagementService.connectionInfo.providerId);
		if (this._config.context === 'database') {
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.metadata.subscribe(
				data => {
					if (data) {
						if (flavor && flavor.objectsListProperties) {
							this._propertyList = flavor.objectsListProperties;
						} else {
							this._propertyList = [{
								displayName: NamePropertyDisplayText,
								value: NameProperty,
								widthWeight: 80
							}, {
								displayName: nls.localize('dashboard.explorer.objectTypeDisplayValue', "Type"),
								value: 'metadataTypeName',
								widthWeight: 20
							}];
						}
						const objectData = ObjectMetadataWrapper.createFromObjectMetadata(data.objectMetadata);
						objectData.sort(ObjectMetadataWrapper.sort);
						this.updateTable(objectData);
					}
				},
				error => {
					this.showErrorMessage(nls.localize('dashboard.explorer.objectError', "Unable to load objects"));
				}
			)));
		} else {
			this._register(subscriptionToDisposable(this._bootstrap.metadataService.databases.subscribe(
				data => {
					// Handle the case where there is no metadata service
					data = data || [];
					if (isStringArray(data)) {
						data = data.map(item => {
							const dbInfo: DatabaseInfo = { options: {} };
							dbInfo.options[NameProperty] = item;
							return dbInfo;
						});
					}

					// const profileData = data.map(d => {
					// 	const profile = new ConnectionProfile(this.capabilitiesService, currentProfile);
					// 	profile.databaseName = d.options['name'];
					// 	return profile;
					// });
					if (flavor && flavor.databasesListProperties) {
						this._propertyList = flavor.databasesListProperties;
					} else {
						this._propertyList = [{
							displayName: NamePropertyDisplayText,
							value: NameProperty,
							widthWeight: 80
						}];
					}
					const tableData = data.map(item => item.options);
					tableData.forEach(item => {
						item[IconClassProperty] = 'database-colored';
						item[IconTitleProperty] = nls.localize('dashboard.explorer.objectType.database', "Database");
					});
					this.updateTable(tableData);
				},
				error => {
					this.showErrorMessage(nls.localize('dashboard.explorer.databaseError', "Unable to load databases"));
				}
			)));
		}
	}

	public refresh(): void {
		this.init();
	}

	private get columnDefinitions(): Slick.Column<Slick.SlickData>[] {
		const initialWidth = DOM.getContentWidth(this._tableContainer.nativeElement);
		let totalColumnWidthWeight: number = 0;
		this._propertyList.forEach(p => {
			if (p.widthWeight) {
				totalColumnWidthWeight += p.widthWeight;
			}
		});

		const columns: Slick.Column<Slick.SlickData>[] = this._propertyList.map(property => {
			return <Slick.Column<Slick.SlickData>>{
				id: property.value,
				field: property.value,
				name: property.displayName,
				sortable: false,
				width: property.widthWeight ? initialWidth * (property.widthWeight / totalColumnWidthWeight) : undefined
			};
		});

		columns.unshift(<IconColumnDefinition<Slick.SlickData>>{
			id: 'icon',
			field: IconTitleProperty,
			resizable: false,
			name: '',
			formatter: IconFormatter,
			width: 40,
			selectable: false,
			iconCssClassField: IconClassProperty
		});

		columns.push(this._actionsColumn.definition);

		return columns;
	}

	public layout(): void {
		if (this._inited) {
			this._table.layout(new DOM.Dimension(
				DOM.getContentWidth(this._tableContainer.nativeElement),
				DOM.getContentHeight(this._tableContainer.nativeElement)));
			this._table.columns = this.columnDefinitions;
		}
	}

	private updateTable(data: object[]): void {
		this._table.columns = this.columnDefinitions;
		this._table.setData(data);
		this._table.updateRowCount();
		this.setLoadingStatus(false);
	}


	private showErrorMessage(message: string): void {
		(<HTMLElement>this._el.nativeElement).innerText = message;
		alert(message);
	}

	public getTableHeight(): string {
		return `calc(100% - ${this._input.height}px)`;
	}
}
