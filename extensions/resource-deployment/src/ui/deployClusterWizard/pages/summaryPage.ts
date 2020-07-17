/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { SectionInfo, FieldType, LabelPosition, BdcDeploymentType, FontWeight } from '../../../interfaces';
import { createSection, createGroupContainer, createFlexContainer, createLabel } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { AuthenticationMode } from '../deployClusterWizardModel';
import * as localizedConstants from '../../../localizedConstants';
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
			this.form = view.modelBuilder.formContainer();
			return view.initializeModel(this.form!.withLayout({ width: '100%' }).component());
		});
	}

	public async onEnter(): Promise<void> {
		this.wizard.showCustomButtons();
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
					items: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.Kubeconfig', "Kube config"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.KubeConfigPath_VariableName),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ClusterContext', "Cluster context"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterContext_VariableName),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
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

					items: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.DeploymentProfile', "Deployment profile"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.DeploymentProfile_VariableName),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						},
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ClusterName', "Cluster name"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterName_VariableName),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}]
				}, {
					items: [
						{
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.ControllerUsername', "Controller username"),
							defaultValue: this.wizard.model.getStringValue(VariableNames.AdminUserName_VariableName),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}, {
							type: FieldType.ReadonlyText,
							label: localize('deployCluster.AuthenticationMode', "Authentication mode"),
							defaultValue: this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory ?
								localize('deployCluster.AuthenticationMode.ActiveDirectory', "Active Directory") :
								localize('deployCluster.AuthenticationMode.Basic', "Basic"),
							labelCSSStyles: { fontWeight: FontWeight.Bold }
						}
					]
				}
			]
		};

		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.OuDistinguishedName', "Organizational unit"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.OrganizationalUnitDistinguishedName_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					},
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DomainControllerFQDNs', "Domain controller FQDNs"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DomainControllerFQDNs_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DomainDNSIPAddresses', "Domain DNS IP addresses"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DomainDNSIPAddresses_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					},
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DomainDNSName', "Domain DNS name"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DomainDNSName_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ClusterAdmins', "Cluster admin group"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterAdmins_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					},
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ClusterUsers', "Cluster users"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ClusterUsers_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.AppOwners', "App owners"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.AppOwners_VariableName, ''),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					},
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.AppReaders', "App readers"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.AppReaders_VariableName, ''),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.Subdomain', "Subdomain"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.Subdomain_VariableName, ''),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					},
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.AccountPrefix', "Account prefix"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.AccountPrefix_VariableName, ''),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
			clusterSectionInfo.rows!.push({
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DomainServiceAccountUserName', "Service account username"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DomainServiceAccountUserName_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localizedConstants.realm,
						defaultValue: this.wizard.model.getStringValue(VariableNames.Realm_VariableName, ''),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
			});
		}

		const azureSectionInfo: SectionInfo = {
			labelPosition: LabelPosition.Left,
			labelWidth: '150px',
			inputWidth: '200px',
			title: localize('deployCluster.AzureSettings', "Azure settings"),
			rows: [{
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.SubscriptionId', "Subscription id"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.SubscriptionId_VariableName) || localize('deployCluster.DefaultSubscription', "Default Azure Subscription"),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ResourceGroup', "Resource group"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ResourceGroup_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}
				]
			}, {
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.Location', "Location"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.Location_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.AksClusterName', "AKS cluster name"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.AksName_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}
				]
			}, {
				items: [
					{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.VMSize', "VM size"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.VMSize_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.VMCount', "VM count"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.VMCount_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
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
					items: [{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.MasterSqlServerInstances', "SQL Server master instances"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.SQLServerScale_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.ComputePoolInstances', "Compute pool instances"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.ComputePoolScale_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
				}, {
					items: [{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.DataPoolInstances', "Data pool instances"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.DataPoolScale_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}, {
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.SparkPoolInstances', "Spark pool instances"),
						defaultValue: this.wizard.model.getStringValue(VariableNames.SparkPoolScale_VariableName),
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
				}, {
					items: [{
						type: FieldType.ReadonlyText,
						label: localize('deployCluster.StoragePoolInstances', "Storage pool (HDFS) instances"),
						defaultValue: `${this.wizard.model.getStringValue(VariableNames.HDFSPoolScale_VariableName)} ${this.wizard.model.getBooleanValue(VariableNames.IncludeSpark_VariableName) ? localize('deployCluster.WithSpark', "(Spark included)") : ''}`,
						labelCSSStyles: { fontWeight: FontWeight.Bold }
					}]
				}
			]
		};

		const createSectionFunc = async (sectionInfo: SectionInfo): Promise<azdata.FormComponent> => {
			return {
				title: '',
				component: await createSection({
					container: this.wizard.wizardObject,
					inputComponents: this.wizard.inputComponents,
					sectionInfo: sectionInfo,
					view: this.view,
					onNewDisposableCreated: () => { },
					onNewInputComponentCreated: () => { },
					onNewValidatorCreated: () => { }
				})
			};
		};

		if (this.wizard.deploymentType === BdcDeploymentType.ExistingAKS || this.wizard.deploymentType === BdcDeploymentType.ExistingKubeAdm) {
			const deploymentTargetSection = await createSectionFunc(deploymentTargetSectionInfo);
			this.formItems.push(deploymentTargetSection);
		}

		const clusterSection = await createSectionFunc(clusterSectionInfo);
		const scaleSection = await createSectionFunc(scaleSectionInfo);
		const endpointSection = {
			title: '',
			component: this.createEndpointSection()
		};
		const storageSection = {
			title: '',
			component: this.createStorageSection()
		};
		if (this.wizard.model.getStringValue(VariableNames.AksName_VariableName)) {
			const azureSection = await createSectionFunc(azureSectionInfo);
			this.formItems.push(azureSection);
		}

		this.formItems.push(clusterSection, scaleSection, endpointSection, storageSection);
		this.form.addFormItems(this.formItems);
	}

	public onLeave() {
		this.wizard.hideCustomButtons();
		this.wizard.wizardObject.message = { text: '' };
	}

	private getStorageSettingValue(propertyName: string, defaultValuePropertyName: string): string | undefined {
		const value = this.wizard.model.getStringValue(propertyName);
		return (value === undefined || value === '') ? this.wizard.model.getStringValue(defaultValuePropertyName) : value;
	}

	private createStorageSection(): azdata.GroupContainer {
		const serviceNameColumn: azdata.TableColumn = {
			value: localize('deployCluster.ServiceName', "Service"),
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

		const storageTableTitle = localize('deployCluster.StorageSettings', "Storage settings");
		const storageTable = this.view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			title: storageTableTitle,
			ariaLabel: storageTableTitle,
			data: [
				[
					localize('deployCluster.ControllerText', "Controller"),
					this.wizard.model.getStringValue(VariableNames.ControllerDataStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerDataStorageSize_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerLogsStorageClassName_VariableName),
					this.wizard.model.getStringValue(VariableNames.ControllerLogsStorageSize_VariableName)],
				[
					localize('deployCluster.StoragePool', "Storage pool (HDFS)"),
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
			this.createEndpointRow(localize('deployCluster.GatewayText', "Gateway"), VariableNames.GatewayDNSName_VariableName, VariableNames.GateWayPort_VariableName),
			this.createEndpointRow(localize('deployCluster.AppServiceProxyText', "Application proxy"), VariableNames.AppServiceProxyDNSName_VariableName, VariableNames.AppServiceProxyPort_VariableName),
			this.createEndpointRow(localize('deployCluster.ServiceProxyText', "Management proxy"), VariableNames.ServiceProxyDNSName_VariableName, VariableNames.ServiceProxyPort_VariableName)
		];

		if (this.wizard.model.getIntegerValue(VariableNames.SQLServerScale_VariableName) > 1) {
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
		items.push(createLabel(this.view, { text: name, width: '150px', cssStyles: { fontWeight: FontWeight.Bold } }));
		if (this.wizard.model.authenticationMode === AuthenticationMode.ActiveDirectory) {
			items.push(createLabel(this.view, {
				text: this.wizard.model.getStringValue(dnsVariableName)!, width: '200px'
			}));
		}
		items.push(createLabel(this.view, {
			text: this.wizard.model.getStringValue(portVariableName)!, width: '100px'
		}));
		return createFlexContainer(this.view, items);
	}
}
