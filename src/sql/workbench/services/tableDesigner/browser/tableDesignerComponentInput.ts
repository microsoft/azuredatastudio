/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { DesignerViewModel, DesignerEdit, DesignerEditResult, DesignerComponentInput, DesignerView, DesignerTab, DesignerDataPropertyInfo, DropDownProperties, DesignerTableProperties, DesignerState } from 'sql/base/browser/ui/designer/interfaces';
import { TableDesignerProvider } from 'sql/workbench/services/tableDesigner/common/interface';
import { localize } from 'vs/nls';
import { designers } from 'sql/workbench/api/common/sqlExtHostTypes';
import { Emitter, Event } from 'vs/base/common/event';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';

export class TableDesignerComponentInput implements DesignerComponentInput {

	private _viewModel: DesignerViewModel;
	private _view: DesignerView;
	private _valid: boolean = true;
	private _dirty: boolean = false;
	private _saving: boolean = false;
	private _onStateChange = new Emitter<DesignerState>();

	public readonly onStateChange: Event<DesignerState> = this._onStateChange.event;

	constructor(private readonly _provider: TableDesignerProvider,
		private _tableInfo: azdata.designers.TableInfo,
		@INotificationService private readonly _notificationService: INotificationService) {
	}

	get valid(): boolean {
		return this._valid;
	}

	get dirty(): boolean {
		return this._dirty;
	}

	get saving(): boolean {
		return this._saving;
	}

	get objectTypeDisplayName(): string {
		return localize('tableDesigner.tableObjectType', "Table");
	}

	async getView(): Promise<DesignerView> {
		if (!this._view) {
			await this.initialize();
		}
		return this._view;
	}

	async getViewModel(): Promise<DesignerViewModel> {
		if (!this._viewModel) {
			await this.initialize();
		}
		return this._viewModel;
	}

	async processEdit(edit: DesignerEdit): Promise<DesignerEditResult> {
		const result = await this._provider.processTableEdit(this._tableInfo, this._viewModel!, edit);
		if (result.isValid) {
			this._viewModel = result.viewModel;
		}
		this.updateState(result.isValid, true, this.saving);
		return {
			isValid: result.isValid,
			errors: result.errors
		};
	}

	async save(): Promise<void> {
		const notificationHandle = this._notificationService.notify({
			severity: Severity.Info,
			message: localize('tableDesigner.savingChanges', "Saving table designer changes...")
		});
		try {
			this.updateState(this.valid, this.dirty, true);
			await this._provider.saveTable(this._tableInfo, this._viewModel);
			this.updateState(true, false, false);
			notificationHandle.updateMessage(localize('tableDesigner.savedChangeSuccess', "The changes have been successfully saved."));
		} catch (error) {
			notificationHandle.updateSeverity(Severity.Error);
			notificationHandle.updateMessage(localize('tableDesigner.saveChangeError', "An error occured while saving changes: {0}", error?.message ?? error));
			this.updateState(this.valid, this.dirty, false);
		}
	}

	async revert(): Promise<void> {
		this.updateState(true, false, false);
	}

	private updateState(valid: boolean, dirty: boolean, saving: boolean): void {
		if (this._dirty !== dirty || this._valid !== valid || this._saving !== saving) {
			this._dirty = dirty;
			this._valid = valid;
			this._saving = saving;
			this._onStateChange.fire({
				valid: this._valid,
				dirty: this._dirty,
				saving: this._saving
			});
		}
	}

	private async initialize(): Promise<void> {
		const designerInfo = await this._provider.getTableDesignerInfo(this._tableInfo);

		this._viewModel = designerInfo.viewModel;
		this.setDefaultData();

		const advancedTabComponents: DesignerDataPropertyInfo[] = [
			{
				componentType: 'dropdown',
				propertyName: designers.TableProperty.Schema,
				componentProperties: <DropDownProperties>{
					title: localize('tableDesigner.schemaTitle', "Schema"),
					values: designerInfo.schemas
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableProperty.Description,
				componentProperties: {
					title: localize('tableDesigner.descriptionTitle', "Description")
				}
			}
		];

		if (designerInfo.view.additionalTableProperties) {
			advancedTabComponents.push(...designerInfo.view.additionalTableProperties);
		}

		const advancedTab = <DesignerTab>{
			title: localize('tableDesigner.advancedTab', "Advanced"),
			components: advancedTabComponents
		};

		const columnProperties: DesignerDataPropertyInfo[] = [
			{
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Name,
				componentProperties: {
					title: localize('tableDesigner.columnNameTitle', "Name"),
					width: 150
				}
			}, {
				componentType: 'dropdown',
				propertyName: designers.TableColumnProperty.Type,
				componentProperties: {
					title: localize('tableDesigner.columnTypeTitle', "Type"),
					width: 100,
					values: designerInfo.columnTypes
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Length,
				componentProperties: {
					title: localize('tableDesigner.columnLengthTitle', "Length"),
					width: 75
				}
			}, {
				componentType: 'input',
				propertyName: designers.TableColumnProperty.DefaultValue,
				componentProperties: {
					title: localize('tableDesigner.columnDefaultValueTitle', "Default Value"),
					width: 150
				}
			}, {
				componentType: 'checkbox',
				propertyName: designers.TableColumnProperty.AllowNulls,
				componentProperties: {
					title: localize('tableDesigner.columnAllowNullTitle', "Allow Nulls"),
				}
			}, {
				componentType: 'checkbox',
				propertyName: designers.TableColumnProperty.IsPrimaryKey,
				componentProperties: {
					title: localize('tableDesigner.columnIsPrimaryKeyTitle', "Primary Key"),
				}
			}
		];

		if (designerInfo.view.additionalTableColumnProperties) {
			columnProperties.push(...designerInfo.view.additionalTableColumnProperties);
		}

		const columnsTab = <DesignerTab>{
			title: localize('tableDesigner.columnsTabTitle', "Columns"),
			components: [
				{
					componentType: 'table',
					propertyName: designers.TableProperty.Columns,
					componentProperties: <DesignerTableProperties>{
						ariaLabel: localize('tableDesigner.columnsTabTitle', "Columns"),
						columns: [
							designers.TableColumnProperty.Name,
							designers.TableColumnProperty.Type,
							designers.TableColumnProperty.Length,
							designers.TableColumnProperty.DefaultValue,
							designers.TableColumnProperty.AllowNulls,
							designers.TableColumnProperty.IsPrimaryKey
						],
						itemProperties: columnProperties,
						objectTypeDisplayName: localize('tableDesigner.columnTypeName', "Column")
					}
				}
			]
		};

		const tabs = [columnsTab, advancedTab];
		if (designerInfo.view.additionalTabs) {
			tabs.push(...tabs);
		}

		this._view = {
			components: [{
				componentType: 'input',
				propertyName: designers.TableColumnProperty.Name,
				componentProperties: {
					title: localize('tableDesigner.nameTitle', "Table name"),
					width: 200
				}
			}],
			tabs: tabs
		};
	}

	private setDefaultData(): void {
		const properties = Object.keys(this._viewModel);
		this.setDefaultInputData(properties, designers.TableProperty.Name);
		this.setDefaultInputData(properties, designers.TableProperty.Schema);
		this.setDefaultInputData(properties, designers.TableProperty.Description);
	}

	private setDefaultInputData(allProperties: string[], property: string): void {
		if (allProperties.indexOf(property) === -1) {
			this._viewModel[property] = {};
		}
	}
}
