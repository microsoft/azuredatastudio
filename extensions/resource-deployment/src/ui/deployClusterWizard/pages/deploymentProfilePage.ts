/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDeploymentType } from '../../../interfaces';
import { BigDataClusterDeploymentProfile } from '../../../services/bigDataClusterDeploymentProfile';
import { createFlexContainer, createLabel } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
const localize = nls.loadMessageBundle();

const serviceScaleTableTitle = localize('deployCluster.serviceScaleTableTitle', "Service scale settings (Instances)");
const storageTableTitle = localize('deployCluster.storageTableTitle', "Service storage settings (GB per Instance)");
const featureTableTitle = localize('deployCluster.featureTableTitle', "Features");
const YesText = localize('deployCluster.yesText', "Yes");
const NoText = localize('deployCluster.noText', "No");

export class DeploymentProfilePage extends WizardPageBase<DeployClusterWizard> {
	private _loadingComponent: azdata.LoadingComponent | undefined;
	private _container: azdata.FlexContainer | undefined;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Deployment configuration profile"),
			localize('deployCluster.summaryPageDescription', "Select the target configuration profile"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent(async (view: azdata.ModelView): Promise<void> => {
			this._container = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			const hintText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.ProfileHintText', "Note: The settings of the deployment profile can be customized in later steps.")
			}).component();
			const container = createFlexContainer(view, [this._container, hintText], false);
			this._loadingComponent = view.modelBuilder.loadingComponent().withItem(container).withProperties<azdata.LoadingComponentProperties>({
				loading: true,
				loadingText: localize('deployCluster.loadingProfiles', "Loading profiles"),
				loadingCompletedText: localize('deployCluster.loadingProfilesCompleted', "Loading profiles completed"),
				showText: true
			}).component();
			let formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						title: '',
						component: this._loadingComponent
					}
				],
				{
					horizontal: false
				}
			).withLayout({ width: '100%', height: '100%' });
			const form = formBuilder.withLayout({ width: '100%' }).component();
			await view.initializeModel(form);
			await this.loadProfiles(view);
		});
	}

	private setModelValuesByProfile(selectedProfile: BigDataClusterDeploymentProfile): void {
		this.wizard.model.setPropertyValue(VariableNames.DeploymentProfile_VariableName, selectedProfile.profileName);
		this.wizard.model.setPropertyValue(VariableNames.SparkPoolScale_VariableName, selectedProfile.sparkReplicas);
		this.wizard.model.setPropertyValue(VariableNames.DataPoolScale_VariableName, selectedProfile.dataReplicas);
		this.wizard.model.setPropertyValue(VariableNames.HDFSPoolScale_VariableName, selectedProfile.hdfsReplicas);
		this.wizard.model.setPropertyValue(VariableNames.ComputePoolScale_VariableName, selectedProfile.computeReplicas);
		this.wizard.model.setPropertyValue(VariableNames.HDFSNameNodeScale_VariableName, selectedProfile.hdfsNameNodeReplicas);
		this.wizard.model.setPropertyValue(VariableNames.SQLServerScale_VariableName, selectedProfile.sqlServerReplicas);
		this.wizard.model.setPropertyValue(VariableNames.SparkHeadScale_VariableName, selectedProfile.sparkHeadReplicas);
		this.wizard.model.setPropertyValue(VariableNames.ZooKeeperScale_VariableName, selectedProfile.zooKeeperReplicas);
		this.wizard.model.setPropertyValue(VariableNames.ControllerDataStorageSize_VariableName, selectedProfile.controllerDataStorageSize);
		this.wizard.model.setPropertyValue(VariableNames.ControllerLogsStorageSize_VariableName, selectedProfile.controllerLogsStorageSize);
		this.wizard.model.setPropertyValue(VariableNames.SQLServerPort_VariableName, selectedProfile.sqlServerPort);
		this.wizard.model.setPropertyValue(VariableNames.GateWayPort_VariableName, selectedProfile.gatewayPort);
		this.wizard.model.setPropertyValue(VariableNames.ControllerPort_VariableName, selectedProfile.controllerPort);
		this.wizard.model.setPropertyValue(VariableNames.ServiceProxyPort_VariableName, selectedProfile.serviceProxyPort);
		this.wizard.model.setPropertyValue(VariableNames.AppServiceProxyPort_VariableName, selectedProfile.appServiceProxyPort);
		this.wizard.model.setPropertyValue(VariableNames.IncludeSpark_VariableName, selectedProfile.includeSpark);
		this.wizard.model.setPropertyValue(VariableNames.ControllerDataStorageClassName_VariableName, selectedProfile.controllerDataStorageClass);
		this.wizard.model.setPropertyValue(VariableNames.ControllerLogsStorageClassName_VariableName, selectedProfile.controllerLogsStorageClass);
		this.wizard.model.setPropertyValue(VariableNames.ReadableSecondaryPort_VariableName, selectedProfile.sqlServerReadableSecondaryPort);
		this.wizard.model.setPropertyValue(VariableNames.DockerRegistry_VariableName, selectedProfile.registry);
		this.wizard.model.setPropertyValue(VariableNames.DockerRepository_VariableName, selectedProfile.repository);
		this.wizard.model.setPropertyValue(VariableNames.DockerImageTag_VariableName, selectedProfile.imageTag);
		this.wizard.model.adAuthSupported = selectedProfile.activeDirectorySupported;
		this.wizard.model.selectedProfile = selectedProfile;
	}

	private async loadProfiles(view: azdata.ModelView): Promise<void> {
		try {
			const profiles = await this.wizard.azdataService.getDeploymentProfiles(this.wizard.deploymentType);
			const radioButtonGroup = this.createRadioButtonGroup(view, profiles);
			const serviceScaleTable = this.createServiceScaleTable(view, profiles);
			const storageTable = this.createStorageTable(view, profiles);
			const featuresTable = this.createFeaturesTable(view, profiles);
			this._container!.addItem(createLabel(view, { text: localize('deployCluster.profileRadioGroupLabel', "Deployment configuration profile") }), {
				CSSStyles: { 'margin-bottom': '5px' }
			});
			this._container!.addItem(radioButtonGroup, {
				CSSStyles: { 'margin-bottom': '20px' }
			});
			this._container!.addItems([
				this.createTableGroup(view, serviceScaleTableTitle, serviceScaleTable),
				this.createTableGroup(view, storageTableTitle, storageTable),
				this.createTableGroup(view, featureTableTitle, featuresTable)
			], {
				CSSStyles: { 'margin-bottom': '10px' }
			});
			this._loadingComponent!.loading = false;
		} catch (error) {
			this.wizard.wizardObject.message = {
				level: azdata.window.MessageLevel.Error,
				text: localize('deployCluster.loadProfileFailed', "Failed to load the deployment profiles: {0}", error.message)
			};
			this._loadingComponent!.loading = false;
		}
	}

	private createRadioButtonGroup(view: azdata.ModelView, profiles: BigDataClusterDeploymentProfile[]): azdata.FlexContainer {
		const defaultProfile: string = this.getDefaultProfile();
		const groupName = 'profileGroup';
		const radioButtons = profiles.map(profile => {
			const checked = profile.profileName === defaultProfile;
			const radioButton = view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
				label: profile.profileName,
				checked: checked,
				name: groupName
			}).component();
			if (checked) {
				this.setModelValuesByProfile(profile);
				radioButton.focus();
			}
			this.wizard.registerDisposable(radioButton.onDidClick(() => {
				this.wizard.wizardObject.message = { text: '' };
				this.setModelValuesByProfile(profile);
			}));
			return radioButton;
		});
		return view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row' }).withItems(radioButtons, { flex: '0 0 auto', CSSStyles: { 'margin-right': '20px' } }).component();
	}

	private createServiceScaleTable(view: azdata.ModelView, profiles: BigDataClusterDeploymentProfile[]): azdata.TableComponent {
		const data = [
			[localize('deployCluster.masterPoolLabel', "SQL Server Master"), ...profiles.map(profile => profile.sqlServerReplicas.toString())],
			[localize('deployCluster.computePoolLable', "Compute"), ...profiles.map(profile => profile.computeReplicas.toString())],
			[localize('deployCluster.dataPoolLabel', "Data"), ...profiles.map(profile => profile.dataReplicas.toString())],
			[localize('deployCluster.hdfsLabel', "HDFS + Spark"), ...profiles.map(profile => profile.hdfsReplicas.toString())]
		];

		return view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			columns: [this.createDescriptionColumn(localize('deployCluster.ServiceName', "Service")), ...this.createProfileColumns(profiles)],
			data: data,
			title: serviceScaleTableTitle,
			ariaLabel: serviceScaleTableTitle,
			height: 140,
			width: 200 + 150 * profiles.length
		}).component();
	}

	private createStorageTable(view: azdata.ModelView, profiles: BigDataClusterDeploymentProfile[]): azdata.TableComponent {
		const data = [
			[localize('deployCluster.dataStorageType', "Data"), ...profiles.map(profile => profile.controllerDataStorageSize.toString())],
			[localize('deployCluster.logsStorageType', "Logs"), ...profiles.map(profile => profile.controllerLogsStorageSize.toString())]
		];
		return view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			columns: [this.createDescriptionColumn(localize('deployCluster.StorageType', "Storage type")), ...this.createProfileColumns(profiles)],
			data: data,
			title: storageTableTitle,
			ariaLabel: storageTableTitle,
			height: 80,
			width: 200 + 150 * profiles.length
		}).component();
	}

	private createFeaturesTable(view: azdata.ModelView, profiles: BigDataClusterDeploymentProfile[]): azdata.TableComponent {
		const data = [
			[localize('deployCluster.basicAuthentication', "Basic authentication"), ...profiles.map(profile => YesText)],
		];
		if (profiles.findIndex(profile => profile.activeDirectorySupported) !== -1) {
			data.push([localize('deployCluster.activeDirectoryAuthentication', "Active Directory authentication"), ...profiles.map(profile => profile.activeDirectorySupported ? YesText : NoText)]);
		}

		if (profiles.findIndex(profile => profile.sqlServerReplicas > 1) !== -1) {
			data.push([localize('deployCluster.hadr', "High Availability"), ...profiles.map(profile => profile.sqlServerReplicas > 1 ? YesText : NoText)]);
		}

		return view.modelBuilder.table().withProperties<azdata.TableComponentProperties>({
			columns: [this.createDescriptionColumn(localize('deployCluster.featureText', "Feature")), ...this.createProfileColumns(profiles)],
			data: data,
			title: featureTableTitle,
			ariaLabel: featureTableTitle,
			height: 30 + data.length * 25,
			width: 200 + 150 * profiles.length
		}).component();
	}

	private createDescriptionColumn(header: string): azdata.TableColumn {
		return {
			value: header,
			width: 150
		};
	}

	private createProfileColumns(profiles: BigDataClusterDeploymentProfile[]): azdata.TableColumn[] {
		return profiles.map(profile => {
			return {
				value: profile.profileName,
				width: 100
			};
		});
	}
	private createTableGroup(view: azdata.ModelView, title: string, table: azdata.TableComponent): azdata.FlexContainer {
		return view.modelBuilder.flexContainer()
			.withItems([createLabel(view, { text: title }), table], { CSSStyles: { 'margin-bottom': '5px' } })
			.withLayout({ flexFlow: 'column' })
			.component();
	}

	public async onEnter(): Promise<void> {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const isValid = this.wizard.model.getStringValue(VariableNames.DeploymentProfile_VariableName) !== undefined;
				if (!isValid) {
					this.wizard.wizardObject.message = {
						text: localize('deployCluster.ProfileNotSelectedError', "Please select a deployment profile."),
						level: azdata.window.MessageLevel.Error
					};
				}
				return isValid;
			}
			return true;
		});
	}

	public onLeave() {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			return true;
		});
	}

	private getDefaultProfile(): string {
		switch (this.wizard.deploymentType) {
			case BdcDeploymentType.NewAKS:
			case BdcDeploymentType.ExistingAKS:
				return 'aks-dev-test';
			case BdcDeploymentType.ExistingKubeAdm:
				return 'kubeadm-dev-test';
			case BdcDeploymentType.ExistingARO:
				return 'aro-dev-test';
			case BdcDeploymentType.ExistingOpenShift:
				return 'openshift-dev-test';
			default:
				throw new Error(`Unknown deployment type: ${this.wizard.deploymentType}`);
		}
	}
}
