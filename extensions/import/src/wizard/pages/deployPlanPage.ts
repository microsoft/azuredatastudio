/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as nls from 'vscode-nls';
import * as parser from 'htmlparser2';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard } from '../dataTierApplicationWizard';
import { DacFxConfigPage } from '../api/dacFxConfigPage';

const localize = nls.loadMessageBundle();

export enum deployPlanXml {
	AlertElement = 'Alert',
	OperationElement = 'Operation',
	ItemElement = 'Item',
	NameAttribute = 'Name',
	ValueAttribute = 'Value',
	TypeAttribute = 'Type',
	IdAttribute = 'Id',
	DataIssueAttribute = 'DataIssue'
}

export class TableObject {
	operation: string;
	object: string;
	type: string;
	dataloss: boolean;
}

export class DeployPlanResult {
	columnData: Array<Array<string>>;
	dataLossAlerts: Set<string>;
}

export class DeployPlanPage extends DacFxConfigPage {
	protected readonly wizardPage: sqlops.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;
	private table: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;
	private dataLossCheckbox: sqlops.CheckBoxComponent;
	private dataLossText: sqlops.TextComponent;
	private dataLossComponentGroup: sqlops.FormComponentGroup;
	private noDataLossTextComponent: sqlops.FormComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
		super(instance, wizardPage, model, view);
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().component();
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
				value: localize('dacfx.dataLossTextWithCount', '{0} of the deploy actions listed may result in data loss. Please ensure you have a backup or snapshot available in the event of an issue with the deployment.', result.dataLossAlerts.size)
			});
			this.dataLossCheckbox.enabled = true;
		} else {
			// check checkbox to enable Next button and remove checkbox because there won't be any possible data loss
			this.dataLossCheckbox.checked = true;
			this.formBuilder.removeFormItem(this.dataLossComponentGroup);
			this.formBuilder.addFormItem(this.noDataLossTextComponent, { componentWidth: 300, horizontal: true });
		}
	}

	private async createDataLossCheckbox(): Promise<sqlops.FormComponent> {
		this.dataLossCheckbox = this.view.modelBuilder.checkBox()
			.withValidation(component => component.checked === true)
			.withProperties({
				label: localize('dacFx.dataLossCheckbox', 'Proceed despite possible data loss'),
			}).component();

		return {
			component: this.dataLossCheckbox,
			title: '',
			required: true
		};
	}

	private async createNoDataLossText(): Promise<sqlops.FormComponent> {
		let noDataLossText = this.view.modelBuilder.text()
			.withProperties({
				value: localize('dacfx.noDataLossText', 'No data loss will occur from the listed deploy actions.')
			}).component();

		return {
			title: '',
			component: noDataLossText
		};
	}

	private async createDataLossComponents(): Promise<sqlops.FormComponentGroup> {
		let dataLossComponent = await this.createDataLossCheckbox();
		this.dataLossText = this.view.modelBuilder.text()
			.withProperties({
				value: localize('dacfx.dataLossText', 'The deploy actions may result in data loss. Please ensure you have a backup or snapshot available in the event of an issue with the deployment.')
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

	private getTableColumns(dataloss: boolean): sqlops.TableColumn[] {
		let columns: sqlops.TableColumn[] = [
			{
				value: localize('dacfx.operationColumn', 'Operation'),
				width: 75,
				cssClass: 'align-with-header',
				toolTip: localize('dacfx.operationTooltip', 'Operation(Create, Alter, Delete) that will occur during deployment')
			},
			{
				value: localize('dacfx.typeColumn', 'Type'),
				width: 100,
				cssClass: 'align-with-header',
				toolTip: localize('dacfx.typeTooltip', 'Type of object that will be affected by deployment')
			},
			{
				value: localize('dacfx.objectColumn', 'Object'),
				width: 300,
				cssClass: 'align-with-header',
				toolTip: localize('dacfx.objecTooltip', 'Name of object that will be affected by deployment')
			}];

		if (dataloss) {
			columns.unshift(
				{
					value: localize('dacfx.dataLossColumn', 'Data Loss'),
					width: 50,
					cssClass: 'center-align',
					toolTip: localize('dacfx.dataLossTooltip', 'Operations that may result in data loss are marked with a warning sign')
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
		let p = new parser.Parser({
			onopentagname(name) {
				if (name === deployPlanXml.AlertElement) {
					currentReportSection = deployPlanXml.AlertElement;
				} else if (name === deployPlanXml.OperationElement) {
					currentReportSection = deployPlanXml.OperationElement;
				} else if (name === deployPlanXml.ItemElement) {
					currentTableObj = new TableObject();
				}
			},
			onattribute: function (name, value) {
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
			onclosetag: function (name) {
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

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
