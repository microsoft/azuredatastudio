/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType } from '../../../interfaces';
import { createSection, createGroupContainer } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
const localize = nls.loadMessageBundle();

export class SummaryPage extends WizardPageBase<DeployClusterWizard> {
	private formItems: azdata.FormComponent[] = [];
	private form!: azdata.FormBuilder;
	private view!: azdata.ModelView;
	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Summary"), '', wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			this.form = view.modelBuilder.formContainer().withFormItems([]);
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	onEnter() {
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];
		const clusterSectionInfo: SectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.ClusterSettings', "Cluster settings"),
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.DeploymentProfile', "Deployment profile"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.DeploymentProfile_VariableName)
				},
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ClusterName', "Cluster name"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.AdminUsername', "Admin username"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.AdminUserName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.AuthenticationMode', "Authentication mode"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.AuthenticationMode_VariableName)
				}
			]
		};

		const azureSectionInfo: SectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.AzureSettings', "Azure settings"),

			fields: [
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.SubscriptionId', "Subscription id"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.SubscriptionId_VariableName) || localize('deployCluster.DefaultSubscription', "Default Azure Subscription")
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ResourceGroup', "Resource group"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ResourceGroup_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.Region', "Region"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.DeploymentProfile_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.AksClusterName', "AKS cluster name"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.AksName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.VMSize', "VM size"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.VMSize_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.VMCount', "VM count"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.VMCount_VariableName)
				}
			]
		};

		const scaleSectionInfo: SectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.ScaleSettings', "Scale settings"),
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.MasterSQLServerScale_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ComputeText', "Compute"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ComputePoolScale_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.DataText', "Data"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.DataPoolScale_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.HDFSNameNodeText', "HDFS name node"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.HDFSNameNodeScale_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.HDFSText', "HDFS"),
					defaultValue: `${this.wizard.model.getStringValue(VariableNames.HDFSPoolScale_VariableName)} ${this.wizard.model.getBooleanValue(VariableNames.IncludeSpark_VariableName) ? localize('deployCluster.WithSpark', "(Spark included)") : ''}`
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.SparkText', "Spark"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.SparkPoolScale_VariableName)
				}
			]
		};
		const portSectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.PortSettings', "Port settings"),
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ControllerText', "Controller"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ControllerPort_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.SQLServerPort_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.GatewayText', "Gateway"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.GateWayPort_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ReadableSecondaryText', "Readable secondary"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ReadableSecondaryPort_VariableName)
				}
			]
		};
		const dnsNamesSectionInfo = {
			labelOnLeft: true,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.DnsNames', "DNS names"),
			fields: [
				{
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ControllerText', "Controller"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ControllerDNSName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.MasterSqlText', "Master SQL Server"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.SQLServerDNSName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.GatewayText', "Gateway"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.GatewayDNSName_VariableName)
				}, {
					type: FieldType.ReadonlyText,
					label: localize('deployCluster.ReadableSecondaryText', "Readable secondary"),
					defaultValue: this.wizard.model.getStringValue(VariableNames.ReadableSecondaryDNSName_VariableName)
				}
			]
		};

		const serviceNameColumn: azdata.TableColumn = {
			value: ' ',
			width: 150
		};
		const dataStorageClassColumn: azdata.TableColumn = {
			value: localize('deployCluster.DataStorageClassName', "STORAGE CLASS FOR DATA"),
			width: 180
		};
		const dataStorageSizeColumn: azdata.TableColumn = {
			value: localize('deployCluster.DataClaimSize', "CLAIM SIZE FOR DATA (GB)"),
			width: 180
		};
		const logStorageClassColumn: azdata.TableColumn = {
			value: localize('deployCluster.LogStorageClassName', "STORAGE CLASS FOR LOGS"),
			width: 180
		};
		const logStorageSizeColumn: azdata.TableColumn = {
			value: localize('deployCluster.LogsClaimSize', "CLAIM SIZE FOR LOGS (GB)"),
			width: 180
		};
		const storageTable = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			data: [
				[
					localize('deployCluster.ControllerText', "Controller"),
					this.wizard.model.getStringValue(VariableNames.ControllerDataStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerDataStorageSize_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerLogsStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerLogsStorageSize_VariableName)],
				[
					localize('deployCluster.HDFSText', "HDFS"),
					this.wizard.model.getStringValue(VariableNames.HDFSDataStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.HDFSDataStorageSize_VariableName),
					this.wizard.model.getStringValue(VariableNames.HDFSLogsStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.HDFSLogsStorageSize_VariableName),
				], [
					localize('deployCluster.DataText', "Data"),
					this.wizard.model.getStringValue(VariableNames.DataPoolDataStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.DataPoolDataStorageSize_VariableName),
					this.wizard.model.getStringValue(VariableNames.DataPoolLogsStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.DataPoolLogsStorageSize_VariableName),
				], [
					localize('deployCluster.MasterSqlText', "Master SQL Server"),
					this.wizard.model.getStringValue(VariableNames.SQLServerDataStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.SQLServerDataStorageSize_VariableName),
					this.wizard.model.getStringValue(VariableNames.SQLServerLogsStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.SQLServerLogsStorageSize_VariableName),
				]
			],
			columns: [serviceNameColumn, dataStorageClassColumn, dataStorageSizeColumn, logStorageClassColumn, logStorageSizeColumn],
			width: '1000px',
			height: '140px'
		}).component();

		const createSectionFunc = (sectionInfo: SectionInfo): azdata.FormComponent => {
			return {
				title: '',
				component: createSection({
					container: this.wizard.wizardObject,
					sectionInfo: sectionInfo,
					view: this.view,
					onNewDisposableCreated: () => { },
					onNewInputComponentCreated: () => { },
					onNewValidatorCreated: () => { }
				})
			};
		};
		const clusterSection = createSectionFunc(clusterSectionInfo);
		const scaleSection = createSectionFunc(scaleSectionInfo);
		const portSection = createSectionFunc(portSectionInfo);
		const storageSection = {
			title: '',
			component: createGroupContainer(this.view, [storageTable], {
				header: localize('deployCluster.StorageSettings', "Storage settings"),
				collapsible: true
			})
		};
		this.formItems.push(clusterSection, scaleSection, portSection);
		this.form.addFormItems([clusterSection, scaleSection, portSection]);
		if (this.wizard.model.getStringValue(VariableNames.AksName_VariableName)) {
			const azureSection = createSectionFunc(azureSectionInfo);
			this.formItems.push(azureSection);
			this.form.addFormItem(azureSection);
		}

		if (this.wizard.model.adAuthSupported) {
			const dnsNamesSection = createSectionFunc(dnsNamesSectionInfo);
			this.formItems.push(dnsNamesSection);
			this.form.addFormItem(dnsNamesSection);
		}

		this.formItems.push(storageSection);
		this.form.addFormItem(storageSection);
	}
}
