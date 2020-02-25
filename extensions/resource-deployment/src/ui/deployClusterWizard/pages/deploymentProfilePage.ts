/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { BdcDeploymentType } from '../../../interfaces';
import { BigDataClusterDeploymentProfile } from '../../../services/bigDataClusterDeploymentProfile';
import { createFlexContainer } from '../../modelViewUtils';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { DeployClusterWizard } from '../deployClusterWizard';
const localize = nls.loadMessageBundle();

export class DeploymentProfilePage extends WizardPageBase<DeployClusterWizard> {

	private _profiles: BigDataClusterDeploymentProfile[] = [];
	private _cardContainer: azdata.RadioCardGroupComponent | undefined;
	private _loadingComponent: azdata.LoadingComponent | undefined;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Deployment configuration profile"),
			localize('deployCluster.summaryPageDescription', "Select the target configuration profile"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent(async (view: azdata.ModelView): Promise<void> => {
			this._cardContainer = view.modelBuilder.radioCardGroup().withProperties<azdata.RadioCardGroupComponentProperties>({
				cards: [],
				cardWidth: '240px',
				cardHeight: '355px',
				ariaLabel: localize('deploymentDialog.deploymentOptions', "Deployment options"),
				width: '1000px'
			}).component();
			this.wizard.registerDisposable(this._cardContainer.onSelectionChanged((profileName) => {
				const selectedProfile = this._profiles.find(p => profileName === p.profileName);
				this.wizard.wizardObject.message = { text: '' };
				if (selectedProfile) {
					this.setModelValuesByProfile(selectedProfile);
				}
			}));
			const hintText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.ProfileHintText', "Note: The settings of the deployment profile can be customized in later steps.")
			}).component();
			const container = createFlexContainer(view, [this._cardContainer, hintText], false);
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
			await this.loadCards();
		});
	}

	private createProfileCard(profile: BigDataClusterDeploymentProfile): azdata.RadioCard {
		const scaleDescription: azdata.RadioCardDescription = {
			ariaLabel: localize('deployCluster.scaleDescription', "Scale description"),
			labelHeader: localize('deployCluster.serviceLabel', "Service"),
			valueHeader: localize('deployCluster.instancesLabel', "Instances"),
			contents: [
				{
					label: localize('deployCluster.masterPoolLabel', "SQL Server Master"),
					value: profile.sqlServerReplicas.toString()
				},
				{
					label: localize('deployCluster.computePoolLable', "Compute"),
					value: profile.computeReplicas.toString()
				},
				{
					label: localize('deployCluster.dataPoolLabel', "Data"),
					value: profile.dataReplicas.toString()
				}, {
					label: localize('deployCluster.hdfsLabel', "HDFS + Spark"),
					value: profile.hdfsReplicas.toString()
				}]
		};
		const storageDescription: azdata.RadioCardDescription = {
			ariaLabel: localize('deployCluster.storageDescription', "Storage description"),
			labelHeader: localize('deployCluster.storageSize', "Storage size"),
			valueHeader: localize('deployCluster.gbPerInstance', "GB per Instance"),
			contents: [
				{
					label: localize('deployCluster.defaultDataStorage', "Data storage"),
					value: profile.controllerDataStorageSize.toString()
				}, {
					label: localize('deployCluster.defaultLogStorage', "Log storage"),
					value: profile.controllerLogsStorageSize.toString()
				}
			]
		};

		const featureDescription: azdata.RadioCardDescription = {
			ariaLabel: localize('deployCluster.featureDescription', "Feature description"),
			labelHeader: localize('deployCluster.features', "Features"),
			contents: [
				{
					label: localize('deployCluster.basicAuthentication', "Basic authentication")
				}
			]
		};
		if (profile.activeDirectorySupported) {
			featureDescription.contents.push({
				label: localize('deployCluster.activeDirectoryAuthentication', "Active Directory authentication")
			});
		}

		if (profile.sqlServerReplicas > 1) {
			featureDescription.contents.push({
				label: localize('deployCluster.hadr', "High Availability")
			});
		}

		return {
			id: profile.profileName,
			label: profile.profileName,
			descriptions: [scaleDescription, storageDescription, featureDescription]
		};
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

	private async loadCards(): Promise<void> {
		try {
			this._profiles = await this.wizard.azdataService.getDeploymentProfiles(this.wizard.deploymentType);
			const defaultProfile: string = this.getDefaultProfile();
			this._cardContainer!.cards = this._profiles.map(profile => this.createProfileCard(profile));
			this._loadingComponent!.loading = false;
			this._cardContainer!.selectedCardId = defaultProfile;
		} catch (error) {
			this.wizard.wizardObject.message = {
				level: azdata.window.MessageLevel.Error,
				text: localize('deployCluster.loadProfileFailed', "Failed to load the deployment profiles: {0}", error.message)
			};
			this._loadingComponent!.loading = false;
		}
	}

	public onEnter() {
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
			default:
				throw new Error(`Unknown deployment type: ${this.wizard.deploymentType}`);
		}
	}
}
