/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType, LabelPosition, FontStyle, BdcDeploymentType } from '../../../interfaces';
import { createSection, createGroupContainer, createFlexContainer, createLabel } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import * as os from 'os';
import { join } from 'path';
import * as fs from 'fs';
import { AuthenticationMode } from '../deployClusterWizardModel';
import { BigDataClusterDeploymentProfile } from '../../../services/bigDataClusterDeploymentProfile';
const localize = nls.loadMessageBundle();

export class SummaryPage extends WizardPageBase<DeployClusterWizard> {
	private formItems: azdata.FormComponent[] = [];
	private form!: azdata.FormBuilder;
	private view!: azdata.ModelView;
	private targetDeploymentProfile!: BigDataClusterDeploymentProfile;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Summary"), '', wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			const deploymentJsonSection = createGroupContainer(view, [
				view.modelBuilder.flexContainer().withItems([
					this.createSaveJsonButton(localize('deployCluster.SaveBdcJson', "Save bdc.json"), 'bdc.json', () => { return this.targetDeploymentProfile.getBdcJson(); }),
					this.createSaveJsonButton(localize('deployCluster.SaveControlJson', "Save control.json"), 'control.json', () => { return this.targetDeploymentProfile.getControlJson(); })
				], {
					CSSStyles: { 'margin-right': '10px' }
				}).withLayout({ flexFlow: 'row', alignItems: 'center' }).component()
			], {
				header: localize('deployCluster.DeploymentJSON', "Deployment JSON files"),
				collapsible: true
			});

			this.form = view.modelBuilder.formContainer().withFormItems([
				{
					title: '',
					component: deploymentJsonSection
				}
			]);
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	public onEnter() {
		this.targetDeploymentProfile = this.wizard.model.createTargetProfile();
		this.formItems.forEach(item => {
			this.form!.removeFormItem(item);
		});
		this.formItems = [];

		const deploymentTargetSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.DeploymentTarget', "Deployment target"),
			rows: [
				{
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.Kubeconfig', "Kube config"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.KubeConfigPath_VariableName),
							fontStyle: FontStyle.Italic
						},
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ClusterContext', "Cluster context"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterContext_VariableName),
							fontStyle: FontStyle.Italic
						}]
				}
			]
		};

		const clusterSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.ClusterSettings', "Cluster settings"),
			rows: [
				{

					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.DeploymentProfile', "Deployment profile"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.DeploymentProfile_VariableName),
							fontStyle: FontStyle.Italic
						},
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ClusterName', "Cluster name"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterName_VariableName),
							fontStyle: FontStyle.Italic
						}]
				}, {
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ControllerUsername', "Controller username"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.AdminUserName_VariableName),
							fontStyle: FontStyle.Italic
						}, {
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.AuthenticationMode', "Authentication mode"),
							defaultValue: this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory ?
								localize('deployCluster.AuthenticationMode.ActiveDirectory', "Active Directory") :
								localize('deployCluster.AuthenticationMode.Basic', "Basic"),
							fontStyle: FontStyle.Italic
						}
					]
				}
			]
		};

		const azureSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.AzureSettings', "Azure settings"),
			rows: [{
				fields: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.SubscriptionId', "Subscription id"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.SubscriptionId_VariableName) || localize('deployCluster.DefaultSubscription', "Default Azure Subscription"),
						fontStyle: FontStyle.Italic
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ResourceGroup', "Resource group"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ResourceGroup_VariableName),
						fontStyle: FontStyle.Italic
					}
				]
			}, {
				fields: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.Region', "Region"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.Region_VariableName),
						fontStyle: FontStyle.Italic
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.AksClusterName', "AKS cluster name"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.AksName_VariableName),
						fontStyle: FontStyle.Italic
					}
				]
			}, {
				fields: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.VMSize', "VM size"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.VMSize_VariableName),
						fontStyle: FontStyle.Italic
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.VMCount', "VM count"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.VMCount_VariableName),
						fontStyle: FontStyle.Italic
					}
				]
			}
			]
		};

		const scaleSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.ScaleSettings', "Scale settings"),
			rows: [
				{
					fields: [{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ComputeText', "Compute"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ComputePoolScale_VariableName),
						fontStyle: FontStyle.Italic
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DataText', "Data"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DataPoolScale_VariableName),
						fontStyle: FontStyle.Italic
					}
					]
				}, {
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.HDFSText', "HDFS"),
							defaultValue: `${this.wizard.model.getStringValue(VariableNames.HDFSPoolScale_VariableName)} ${this.wizard.model.getBooleanValue(VariableNames.IncludeSpark_VariableName) ? localize('deployCluster.WithSpark', "(Spark included)") : ''}`,
							fontStyle: FontStyle.Italic
						}, {
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.SparkText', "Spark"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.SparkPoolScale_VariableName),
							fontStyle: FontStyle.Italic
						}
					]
				}
			]
		};

		const hadrSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.HadrSection', "High availability settings"),
			rows: [
				{
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.SqlServerText', "SQL Server Master"),
							defaultValue: `${this.wizard.model.getStringValue(VariableNames.SQLServerScale_VariableName)} ${this.wizard.model.hadrEnabled ? localize('deployCluster.WithHADR', "(Availability Groups Enabled)") : ''}`,
							fontStyle: FontStyle.Italic
						}, {
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.HDFSNameNodeText', "HDFS name node"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.HDFSNameNodeScale_VariableName),
							fontStyle: FontStyle.Italic
						}
					]
				}, {
					fields: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ZooKeeperText', "ZooKeeper"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.ZooKeeperScale_VariableName),
							fontStyle: FontStyle.Italic
						}, {
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.SparkHeadText', "SparkHead"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.SparkHeadScale_VariableName),
							fontStyle: FontStyle.Italic
						}
					]
				}
			]
		};

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

		if (this.wizard.deploymentType === BdcDeploymentType.ExistingAKS || this.wizard.deploymentType === BdcDeploymentType.ExistingKubeAdm) {
			const deploymentTargetSection = createSectionFunc(deploymentTargetSectionInfo);
			this.formItems.push(deploymentTargetSection);
		}

		const clusterSection = createSectionFunc(clusterSectionInfo);
		const scaleSection = createSectionFunc(scaleSectionInfo);
		const hadrSection = createSectionFunc(hadrSectionInfo);
		const endpointSection = {
			title: '',
			component: this.createEndpointSection()
		};
		const storageSection = {
			title: '',
			component: this.createStorageSection()
		};
		if (this.wizard.model.getStringValue(VariableNames.AksName_VariableName)) {
			const azureSection = createSectionFunc(azureSectionInfo);
			this.formItems.push(azureSection);
		}

		this.formItems.push(clusterSection, scaleSection, hadrSection, endpointSection, storageSection);
		this.form.addFormItems(this.formItems);
	}

	private getStorageSettingValue(propertyName: string, defaultValuePropertyName: string): string | undefined {
		const value = this.wizard.model.getStringValue(propertyName);
		return (value === undefined || value === '') ? this.wizard.model.getStringValue(defaultValuePropertyName) : value;
	}

	private createStorageSection(): azdata.GroupContainer {
		const serviceNameColumn: azdata.TableColumn = {
			value: ' ',
			width: 150
		};
		const dataStorageClassColumn: azdata.TableColumn = {
			value: localize('deployCluster.DataStorageClassName', "Storage class for data"),
			width: 180
		};
		const dataStorageSizeColumn: azdata.TableColumn = {
			value: localize('deployCluster.DataClaimSize', "Claim size for data (GB)"),
			width: 180
		};
		const logStorageClassColumn: azdata.TableColumn = {
			value: localize('deployCluster.LogStorageClassName', "Storage class for logs"),
			width: 180
		};
		const logStorageSizeColumn: azdata.TableColumn = {
			value: localize('deployCluster.LogsClaimSize', "Claim size for logs (GB)"),
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
					this.getStorageSettingValue(VariableNames.HDFSDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.HDFSDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName),
					this.getStorageSettingValue(VariableNames.HDFSLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.HDFSLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)
				], [
					localize('deployCluster.DataText', "Data"),
					this.getStorageSettingValue(VariableNames.DataPoolDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.DataPoolDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName),
					this.getStorageSettingValue(VariableNames.DataPoolLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.DataPoolLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)
				], [
					localize('deployCluster.MasterSqlText', "SQL Server Master"),
					this.getStorageSettingValue(VariableNames.SQLServerDataStorageClassName_VariableName, VariableNames.ControllerDataStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.SQLServerDataStorageSize_VariableName, VariableNames.ControllerDataStorageSize_VariableName),
					this.getStorageSettingValue(VariableNames.SQLServerLogsStorageClassName_VariableName, VariableNames.ControllerLogsStorageClassName_VariableName),
					this.getStorageSettingValue(VariableNames.SQLServerLogsStorageSize_VariableName, VariableNames.ControllerLogsStorageSize_VariableName)
				]
			],
			columns: [serviceNameColumn, dataStorageClassColumn, dataStorageSizeColumn, logStorageClassColumn, logStorageSizeColumn],
			width: '1000px',
			height: '140px'
		}).component();
		return createGroupContainer(this.view, [storageTable], {
			header: localize('deployCluster.StorageSettings', "Storage settings"),
			collapsible: true
		});
	}

	private createEndpointSection(): azdata.GroupContainer {
		const endpointRows = [
			this.createEndpointRow(localize('deployCluster.ControllerText', "Controller"), VariableNames.ControllerDNSName_VariableName, VariableNames.ControllerPort_VariableName),
			this.createEndpointRow(localize('deployCluster.SqlServerText', "SQL Server Master"), VariableNames.SQLServerDNSName_VariableName, VariableNames.SQLServerPort_VariableName),
			this.createEndpointRow(localize('deployCluster.GatewayText', "Gateway"), VariableNames.GatewayDNSName_VariableName, VariableNames.GateWayPort_VariableName)
		];

		if (this.wizard.model.hadrEnabled) {
			endpointRows.push(
				this.createEndpointRow(localize('deployCluster.ReadableSecondaryText', "Readable secondary"), VariableNames.ReadableSecondaryDNSName_VariableName, VariableNames.ReadableSecondaryPort_VariableName)
			);
		}
		return createGroupContainer(this.view, endpointRows, {
			header: localize('deployCluster.EndpointSettings', "Endpoint settings"),
			collapsible: true
		});
	}

	private createEndpointRow(name: string, dnsVariableName: string, portVariableName: string): azdata.FlexContainer {
		const items = [];
		items.push(createLabel(this.view, { text: name, width: '150px' }));
		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			items.push(createLabel(this.view, { text: this.wizard.model.getStringValue(dnsVariableName)!, width: '200px', fontStyle: FontStyle.Italic }));
		}
		items.push(createLabel(this.view, { text: this.wizard.model.getStringValue(portVariableName)!, width: '100px', fontStyle: FontStyle.Italic }));
		return createFlexContainer(this.view, items);
	}

	private createSaveJsonButton(label: string, fileName: string, getContent: () => string): azdata.ButtonComponent {
		const button = this.view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			title: label,
			label: fileName,
			ariaLabel: label,
			width: '150px'
		}).component();
		this.wizard.registerDisposable(button.onDidClick(() => {
			vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(join(os.homedir(), fileName)),
				filters: {
					'JSON': ['json']
				}
			}).then((path) => {
				if (path) {
					fs.promises.writeFile(path.fsPath, getContent()).then(() => {
						this.wizard.wizardObject.message = {
							text: localize('deployCluster.SaveJsonFileMessage', "File saved: {0}", path.fsPath),
							level: azdata.window.MessageLevel.Information
						};
					}).catch((error) => {
						this.wizard.wizardObject.message = {
							text: error.message,
							level: azdata.window.MessageLevel.Error
						};
					});
				}
			});
		}));
		return button;
	}
}
