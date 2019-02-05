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

export enum reportSection {
	Alert = 'Alert',
	Operation = 'Operation',
}

export enum attributeName {
	Name = 'Name',
	Value = 'Value',
	Type = 'Type',
	Id = 'Id'
}

export class TableObject {
	object: string;
	type: string;
	dataloss: boolean;
}

export class DeployPlanPage extends DacFxConfigPage {
	protected readonly wizardPage: sqlops.window.modelviewdialog.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: sqlops.ModelView;
	private formBuilder: sqlops.FormBuilder;
	private form: sqlops.FormContainer;
	private table: sqlops.TableComponent;
	private loader: sqlops.LoadingComponent;
	private dataLossCheckbox: sqlops.CheckBoxComponent;
	private dataLossComponentGroup: sqlops.FormComponentGroup;
	private noDataLossTextComponent: sqlops.FormComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: sqlops.window.modelviewdialog.WizardPage, model: DacFxDataModel, view: sqlops.ModelView) {
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
		this.table.data = [];

		// reset checkbox settings
		this.formBuilder.addFormItem(this.dataLossComponentGroup, { horizontal: true, componentWidth: 400 });
		this.dataLossCheckbox.checked = false;
		this.dataLossCheckbox.enabled = false;

		this.formBuilder.removeFormItem(this.noDataLossTextComponent);

		this.loader.loading = true;
		await this.populateTable();
		this.loader.loading = false;
		return true;
	}

	private async populateTable() {
		let data = [];
		let dataNoDataLoss = [];
		let dataLossAlerts = new Set<string>();
		let currentOperation = '';
		let dataIssueAlert = false;
		let currentReportSection: reportSection;
		let currentTableObj: TableObject;

		// parse the xml deploy plan
		let report = await this.instance.generateDeployPlan();
		let p = new parser.Parser({
			onopentagname(name) {
				if (name === 'Alert') {
					currentReportSection = reportSection.Alert;
				} else if (name === 'Operation') {
					currentReportSection = reportSection.Operation;
					currentTableObj = new TableObject();
				}
			},
			onattribute: function (name, value) {
				if (currentReportSection === reportSection.Alert) {
					switch (name) {
						case attributeName.Name: {
							// only care about showing data loss alerts
							if (value === 'DataIssue') {
								dataIssueAlert = true;
							}
							break;
						}
						case attributeName.Id: {
							if (dataIssueAlert) {
								dataLossAlerts.add(value);
							}
							break;
						}
					}
				} else if (currentReportSection === reportSection.Operation) {
					switch (name) {
						case attributeName.Name: {
							currentOperation = value;
							break;
						}
						case attributeName.Value: {
							currentTableObj.object = value;
							break;
						}
						case attributeName.Type: {
							currentTableObj.type = value;
							break;
						}
						case attributeName.Id: {
							if (dataLossAlerts.has(value)) {
								currentTableObj.dataloss = true;
							}
							break;
						}
					}
				}
			},
			onclosetag: function (name) {
				// add table entry for the operation item
				if (name === 'Item') {
					let isDataLoss = currentTableObj.dataloss ? '⚠️' : '';
					data.push([isDataLoss, currentOperation, currentTableObj.type, currentTableObj.object]);
					dataNoDataLoss.push([currentOperation, currentTableObj.type, currentTableObj.object]);
				}
			}
		}, { xmlMode: true, decodeEntities: true });

		p.parseChunk(report);

		if (dataLossAlerts.size > 0) {
			this.table.updateProperties({
				data: data,
				columns: [{
					value: localize('dacfx.dataLossColumn', 'Data Loss'),
					width: 50,
					cssClass: 'center-align',
					toolTip: 'Operations that may result in data loss are marked with a warning sign'
				},
				{
					value: localize('dacfx.operationColumn', 'Operation'),
					width: 75,
					toolTip: 'Operation that will occur during deployment'
				},
				{
					value: localize('dacfx.typeColumn', 'Type'),
					width: 100,
					toolTip: 'Type of object'
				},
				{
					value: localize('dacfx.objectColumn', 'Object'),
					width: 300,
					toolTip: 'Object name'
				}],
				width: 875,
				height: 300
			});

			this.dataLossCheckbox.enabled = true;
		} else {
			this.table.updateProperties({
				data: dataNoDataLoss,
				columns: [{
					value: localize('dacfx.operationColumn', 'Operation'),
					width: 75,
					toolTip: 'Operation that will occur during deployment'
				},
				{
					value: localize('dacfx.typeColumn', 'Type'),
					width: 100,
					toolTip: 'Type of object'
				},
				{
					value: localize('dacfx.objectColumn', 'Object'),
					width: 300,
					toolTip: 'Object name'
				}],
				width: 875,
				height: 300
			});

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
		}
	}

	private async createDataLossComponents(): Promise<sqlops.FormComponentGroup> {
		let dataLossComponent = await this.createDataLossCheckbox();
		let dataLossText = this.view.modelBuilder.text()
			.withProperties({
				value: localize('dacfx.dataLossText', 'The deploy actions listed may result in data loss. Please ensure you have a backup or snapshot available in the event of an issue with the deployment.')
			}).component();

		return {
			title: '',
			components: [
				{
					component: dataLossText,
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

	public setupNavigationValidator() {
		this.instance.registerNavigationValidator(() => {
			return true;
		});
	}
}
