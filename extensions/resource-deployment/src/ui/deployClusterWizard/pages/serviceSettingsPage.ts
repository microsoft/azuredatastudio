/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { Validator, InputComponents, createSection } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import { MasterSQLServerScale_VariableName, ComputePoolScale_VariableName, DataPoolScale_VariableName, HDFSPoolScale_VariableName, SparkPoolScale_VariableName, ControllerDataStorageClassName_VariableName, ControllerLogsStorageClassName_VariableName, ControllerLogsStorageSize_VariableName, HDFSDataStorageClassName_VariableName, HDFSDataStorageSize_VariableName, HDFSLogsStorageClassName_VariableName, HDFSLogsStorageSize_VariableName, DataPoolDataStorageClassName_VariableName, DataPoolDataStorageSize_VariableName, DataPoolLogsStorageClassName_VariableName, DataPoolLogsStorageSize_VariableName, SQLServerDataStorageClassName_VariableName, SQLServerDataStorageSize_VariableName, SQLServerLogsStorageClassName_VariableName, SQLServerLogsStorageSize_VariableName, ControllerDNSName_VariableName, ControllerPort_VariableName, SQLServerDNSName_VariableName, SQLServerPort_VariableName, GatewayDNSName_VariableName, GateWayPort_VariableName, ReadableSecondaryDNSName_VariableName, ReadableSecondaryPort_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class ServiceSettingsPage extends WizardPageBase<DeployClusterWizard> {
	private inputComponents: InputComponents = {};
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.ServiceSettingsPageTitle', "Service settings"), '', wizard);
	}
	public initialize(): void {
		const inputWidth = '180px';
		const labelWidth = '150px';
		const spaceBetweenFields = '5px';
		const scaleSectionInfo: SectionInfo = {
			title: '',
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			labelOnLeft: true,
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: '',
					required: false,
					defaultValue: localize('deployCluster.InstanceLabel', "NUMBER OF INSTANCES"),
					variableName: ''
				},
				{
					type: FieldType.Number,
					label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
					min: 1,
					max: 9,
					defaultValue: '1',
					required: true,
					variableName: MasterSQLServerScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.ComputeText', "Compute"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: ComputePoolScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.DataText', "Data"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: DataPoolScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.HDFSText', "HDFS"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: HDFSPoolScale_VariableName,
				}, {
					type: FieldType.Number,
					label: localize('deployCluster.SparkText', "Spark"),
					min: 1,
					max: 100,
					defaultValue: '1',
					required: true,
					variableName: SparkPoolScale_VariableName
				}
			]
		};

		const PortInputWidth = '100px';
		const PortLabelWidth = '0px';
		const dnsSectionInfo: SectionInfo = {
			title: '',
			labelWidth: labelWidth,
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			rows: [
				{
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: '',
							required: false,
							defaultValue: localize('deployCluster.DNSNameHeader', "DNS NAME"),
							variableName: ''
						}, {
							type: FieldType.ReadonlyText,
							label: '',
							required: false,
							defaultValue: localize('deployCluster.PortHeader', "PORT"),
							variableName: '',
							inputWidth: PortInputWidth,
							labelWidth: PortLabelWidth
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Text,
							label: localize('deployCluster.ControllerText', "Controller"),
							required: true,
							variableName: ControllerDNSName_VariableName
						}, {
							type: FieldType.Number,
							label: '',
							required: true,
							variableName: ControllerPort_VariableName,
							inputWidth: PortInputWidth,
							labelWidth: PortLabelWidth
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Text,
							label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
							required: true,
							variableName: SQLServerDNSName_VariableName
						}, {
							type: FieldType.Number,
							label: '',
							required: true,
							variableName: SQLServerPort_VariableName,
							inputWidth: PortInputWidth,
							labelWidth: PortLabelWidth
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Text,
							label: localize('deployCluster.GatewayText', "Gateway"),
							required: true,
							variableName: GatewayDNSName_VariableName
						}, {
							type: FieldType.Number,
							label: '',
							required: true,
							variableName: GateWayPort_VariableName,
							inputWidth: PortInputWidth,
							labelWidth: PortLabelWidth
						}
					]
				}, {
					fields: [
						{
							type: FieldType.Text,
							label: localize('deployCluster.ReadableSecondaryText', "Readable Secondary"),
							required: true,
							variableName: ReadableSecondaryDNSName_VariableName
						}, {
							type: FieldType.Number,
							label: '',
							required: true,
							variableName: ReadableSecondaryPort_VariableName,
							inputWidth: PortInputWidth,
							labelWidth: PortLabelWidth
						}
					]
				}
			]
		};

		const hintTextForStorageFields = localize('deployCluster.storageFieldTooltip', "Use controller settings");
		const fullDescriptionForStorageFields = localize('deployCluster.storageFieldDescription', "Optional fields, you can leave them blank to use controller settings");
		const storageSectionInfo: SectionInfo = {
			title: '',
			labelWidth: '0px',
			inputWidth: inputWidth,
			spaceBetweenFields: spaceBetweenFields,
			rows: [{
				fields: [
					{
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.DataStorageClassName', "STORAGE CLASS FOR DATA"),
						variableName: '',
						labelWidth: labelWidth
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: 'CLAIM SIZE FOR DATA',
						variableName: ''
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: localize('deployCluster.LogStorageClassName', "STORAGE CLASS FOR LOGS"),
						variableName: '',
					}, {
						type: FieldType.ReadonlyText,
						label: '',
						required: false,
						defaultValue: 'CLAIM SIZE FOR LOGS',
						variableName: ''
					}
				]
			},
			{
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.ControllerText', "Controller"),
						required: true,
						variableName: ControllerDataStorageClassName_VariableName,
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						required: true,
						variableName: ControllerDataStorageClassName_VariableName,
					}, {
						type: FieldType.Text,
						label: '',
						required: true,
						variableName: ControllerLogsStorageClassName_VariableName,
					}, {
						type: FieldType.Number,
						label: '',
						required: true,
						variableName: ControllerLogsStorageSize_VariableName,
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.HDFSText', "HDFS"),
						required: false,
						description: fullDescriptionForStorageFields,
						variableName: HDFSDataStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields,
						labelWidth: labelWidth
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: HDFSDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: HDFSLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: HDFSLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.DataText', "Data"),
						required: false,
						description: fullDescriptionForStorageFields,
						variableName: DataPoolDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: DataPoolDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: DataPoolLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: DataPoolLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}, {
				fields: [
					{
						type: FieldType.Text,
						label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
						description: fullDescriptionForStorageFields,
						required: false,
						variableName: SQLServerDataStorageClassName_VariableName,
						labelWidth: labelWidth,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: SQLServerDataStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Text,
						label: '',
						required: false,
						variableName: SQLServerLogsStorageClassName_VariableName,
						placeHolder: hintTextForStorageFields
					}, {
						type: FieldType.Number,
						label: '',
						required: false,
						variableName: SQLServerLogsStorageSize_VariableName,
						placeHolder: hintTextForStorageFields
					}
				]
			}
			]
		};

		this.pageObject.registerContent((view: azdata.ModelView) => {
			const createSectionFunc = (sectionInfo: SectionInfo): azdata.GroupContainer => {
				return createSection({
					view: view,
					container: this.wizard.wizardObject,
					sectionInfo: sectionInfo,
					onNewDisposableCreated: (disposable: vscode.Disposable): void => {
						this.wizard.registerDisposable(disposable);
					},
					onNewInputComponentCreated: (name: string, component: azdata.DropDownComponent | azdata.InputBoxComponent): void => {
						this.inputComponents[name] = component;
					},
					onNewValidatorCreated: (validator: Validator): void => {
					}
				});
			};
			const scaleSection = createSectionFunc(scaleSectionInfo);

			const dnsSection = createSectionFunc(dnsSectionInfo);
			const storageSection = createSectionFunc(storageSectionInfo);
			const form = view.modelBuilder.formContainer().withFormItems([
				{
					title: localize('deployCluster.scaleSectionTitle', "Scale settings"),
					component: scaleSection
				}, {
					title: localize('deployCluster.DNSSectionTitle', "DNS names and ports"),
					component: dnsSection
				}, {
					title: localize('deployCluster.StorageSectionTitle', "Storage settings"),
					component: storageSection
				}
			]).withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}
}
