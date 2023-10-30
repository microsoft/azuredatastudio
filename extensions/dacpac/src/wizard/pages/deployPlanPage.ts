/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as parser from 'htmlparser2';
import * as loc from '../../localizedConstants';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

enum deployPlanXml {
	AlertElement = 'Alert',
	OperationElement = 'Operation',
	ItemElement = 'Item',
	NameAttribute = 'Name',
	ValueAttribute = 'Value',
	TypeAttribute = 'Type',
	IdAttribute = 'Id',
	DataIssueAttribute = 'DataIssue'
}

class TableObject {
	operation: string;
	object: string;
	type: string;
	dataloss: boolean;
}

class DeployPlanResult {
	columnData: Array<Array<string>>;
	dataLossAlerts: Set<string>;
}

export class DeployPlanPage extends DacFxConfigPage {
	private formBuilder: azdata.FormBuilder;
	private form: azdata.FormContainer;
	private table: azdata.TableComponent;
	private loader: azdata.LoadingComponent;
	private dataLossCheckbox: azdata.CheckBoxComponent;
	private dataLossText: azdata.TextComponent;
	private dataLossComponentGroup: azdata.FormComponentGroup;
	private noDataLossTextComponent: azdata.FormComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().withProps({
			ariaLabel: loc.deployPlanTableTitle,
			data: [],
			columns: []
		}).component();
		this.loader = this.view.modelBuilder.loadingComponent().withItem(this.table).component();
		this.dataLossComponentGroup = await this.createDataLossComponents();
		this.noDataLossTextComponent = await this.createNoDataLossText();

		this.formBuilder = this.view.modelBuilder.formContainer()
			.withFormItems(
				[
					{
						component: this.loader,
						title: ''
					},
					this.dataLossComponentGroup
				], {
				horizontal: true,
			});
		this.form = this.formBuilder.component();
		await this.view.initializeModel(this.form);

		return true;
	}

	async onPageEnter(): Promise<boolean> {
		// reset checkbox settings
		this.formBuilder.addFormItem(this.dataLossComponentGroup, { horizontal: true, componentWidth: 400 });
		this.dataLossCheckbox.checked = false;
		this.dataLossCheckbox.enabled = false;
		this.model.potentialDataLoss = false;
		this.formBuilder.removeFormItem(this.noDataLossTextComponent);

		this.loader.loading = true;
		this.table.data = [];
		await this.populateTable();
		this.loader.loading = false;

		return true;
	}

	private async populateTable() {
		let report = await this.instance.generateDeployPlan();
		let result = this.parseXml(report);

		this.table.updateProperties({
			data: this.getColumnData(result),
			columns: this.getTableColumns(result.dataLossAlerts.size > 0),
			width: 875,
			height: 300
		});

		if (result.dataLossAlerts.size > 0) {
			// update message to list how many operations could result in data loss
			this.dataLossText.updateProperties({
				value: loc.dataLossTextWithCount(result.dataLossAlerts.size)
			});
			this.dataLossCheckbox.enabled = true;
			this.model.potentialDataLoss = true;
		} else {
			// check checkbox to enable Next button and remove checkbox because there won't be any possible data loss
			this.dataLossCheckbox.checked = true;
			this.formBuilder.removeFormItem(this.dataLossComponentGroup);
			this.formBuilder.addFormItem(this.noDataLossTextComponent, { componentWidth: 300, horizontal: true });
		}
	}

	private async createDataLossCheckbox(): Promise<azdata.FormComponent> {
		this.dataLossCheckbox = this.view.modelBuilder.checkBox()
			.withValidation(component => component.checked === true)
			.withProps({
				label: loc.proceedDataLossMessage,
			}).component();

		return {
			component: this.dataLossCheckbox,
			title: '',
			required: true
		};
	}

	private async createNoDataLossText(): Promise<azdata.FormComponent> {
		let noDataLossText = this.view.modelBuilder.text()
			.withProps({
				value: loc.noDataLossMessage
			}).component();

		return {
			title: '',
			component: noDataLossText
		};
	}

	private async createDataLossComponents(): Promise<azdata.FormComponentGroup> {
		let dataLossComponent = await this.createDataLossCheckbox();
		this.dataLossText = this.view.modelBuilder.text()
			.withProps({
				value: loc.dataLossMessage
			}).component();

		return {
			title: '',
			components: [
				{
					component: this.dataLossText,
					layout: {
						componentWidth: 400,
						horizontal: true
					},
					title: ''
				},
				dataLossComponent
			]
		};
	}

	private getColumnData(result: DeployPlanResult): Array<Array<string>> {
		// remove data loss column data if there aren't any alerts
		let columnData = result.columnData;
		if (result.dataLossAlerts.size === 0) {
			columnData.forEach(entry => {
				entry.shift();
			});
		}
		return columnData;
	}

	private getTableColumns(dataloss: boolean): azdata.TableColumn[] {
		let columns: azdata.TableColumn[] = [
			{
				value: loc.operation,
				width: 75,
				cssClass: 'align-with-header',
				toolTip: loc.operationTooltip
			},
			{
				value: loc.type,
				width: 100,
				cssClass: 'align-with-header',
				toolTip: loc.typeTooltip
			},
			{
				value: loc.object,
				width: 300,
				cssClass: 'align-with-header',
				toolTip: loc.objectTooltip
			}];

		if (dataloss) {
			columns.unshift(
				{
					value: loc.dataLoss,
					width: 50,
					cssClass: 'center-align',
					toolTip: loc.dataLossTooltip
				});
		}
		return columns;
	}

	private parseXml(report: string): DeployPlanResult {
		let operations = new Array<TableObject>();
		let dataLossAlerts = new Set<string>();

		let currentOperation = '';
		let dataIssueAlert = false;
		let currentReportSection: deployPlanXml;
		let currentTableObj: TableObject;
		let p = new parser.Parser(<any>{
			onopentagname(name: any) {
				if (name === deployPlanXml.AlertElement) {
					currentReportSection = deployPlanXml.AlertElement;
				} else if (name === deployPlanXml.OperationElement) {
					currentReportSection = deployPlanXml.OperationElement;
				} else if (name === deployPlanXml.ItemElement) {
					currentTableObj = new TableObject();
				}
			},
			onattribute: function (name: any, value: any) {
				if (currentReportSection === deployPlanXml.AlertElement) {
					switch (name) {
						case deployPlanXml.NameAttribute: {
							// only care about showing data loss alerts
							if (value === deployPlanXml.DataIssueAttribute) {
								dataIssueAlert = true;
							}
							break;
						}
						case deployPlanXml.IdAttribute: {
							if (dataIssueAlert) {
								dataLossAlerts.add(value);
							}
							break;
						}
					}
				} else if (currentReportSection === deployPlanXml.OperationElement) {
					switch (name) {
						case deployPlanXml.NameAttribute: {
							currentOperation = value;
							break;
						}
						case deployPlanXml.ValueAttribute: {
							currentTableObj.object = value;
							break;
						}
						case deployPlanXml.TypeAttribute: {
							currentTableObj.type = value;
							break;
						}
						case deployPlanXml.IdAttribute: {
							if (dataLossAlerts.has(value)) {
								currentTableObj.dataloss = true;
							}
							break;
						}
					}
				}
			},
			onclosetag: <any>function (name: any) {
				if (name === deployPlanXml.ItemElement) {
					currentTableObj.operation = currentOperation;
					operations.push(currentTableObj);
				}
			}
		}, { xmlMode: true, decodeEntities: true });
		p.parseChunk(report);

		let data = new Array<Array<string>>();
		operations.forEach(operation => {
			let isDataLoss = operation.dataloss ? '⚠️' : '';
			data.push([isDataLoss, operation.operation, operation.type, operation.object]);
		});

		return {
			columnData: data,
			dataLossAlerts: dataLossAlerts
		};
	}

	public override setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
