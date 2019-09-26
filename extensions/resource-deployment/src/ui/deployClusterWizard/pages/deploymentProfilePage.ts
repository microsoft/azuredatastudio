/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { WizardPageBase } from '../../wizardPageBase';
import * as VariableNames from '../constants';
import { createFlexContainer } from '../../modelViewUtils';
import { BdcDeploymentType } from '../../../interfaces';
import { BigDataClusterDeploymentProfile } from '../../../services/bigDataClusterDeploymentProfile';
const localize = nls.loadMessageBundle();

export class DeploymentProfilePage extends WizardPageBase<DeployClusterWizard> {

	private _cards: azdata.CardComponent[] = [];
	private _cardContainer: azdata.FlexContainer | undefined;
	private _loadingComponent: azdata.LoadingComponent | undefined;
	private _view: azdata.ModelView | undefined;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Deployment configuration template"),
			localize('deployCluster.summaryPageDescription', "Select the target configuration template"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this._view = view;
			this._cardContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', flexWrap: 'wrap' }).component();
			const hintText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize('deployCluster.ProfileHintText', "Note: The settings of the deployment profile can be customized in later steps.")
			}).component();
			const container = createFlexContainer(view, [this._cardContainer, hintText], false);
			this._loadingComponent = view.modelBuilder.loadingComponent().withItem(container).withProperties<azdata.LoadingComponentProperties>({
				loading: true
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
			this.loadCards().then(() => {
				this._loadingComponent!.loading = false;
			}, (error) => {
				this.wizard.wizardObject.message = {
					level: azdata.window.MessageLevel.Error,
					text: localize('deployCluster.loadProfileFailed', "Failed to load the deployment profiles: {0}", error.message)
				};
				this._loadingComponent!.loading = false;
			});
			return view.initializeModel(form);
		});
	}

	private createProfileCard(profile: BigDataClusterDeploymentProfile, view: azdata.ModelView): azdata.CardComponent {
		const descriptions: azdata.CardDescriptionItem[] = [{
			label: localize('deployCluster.serviceLabel', "Service"),
			value: localize('deployCluster.instancesLabel', "Instances"),
			fontWeight: 'bold'
		}, {
			label: localize('deployCluster.masterPoolLabel', "SQL Server Master"),
			value: profile.sqlServerReplicas.toString()
		}, {
			label: localize('deployCluster.computePoolLable', "Compute"),
			value: profile.computeReplicas.toString()
		}, {
			label: localize('deployCluster.dataPoolLabel', "Data"),
			value: profile.dataReplicas.toString()
		}, {
			label: localize('deployCluster.hdfsLabel', "HDFS + Spark"),
			value: profile.hdfsReplicas.toString()
		}, {
			label: '' // line separator
		}, {
			label: localize('deployCluster.defaultDataStorage', "Data storage size (GB)"),
			value: profile.controllerDataStorageSize.toString()
		}, {
			label: localize('deployCluster.defaultLogStorage', "Log storage size (GB)"),
			value: profile.controllerLogsStorageSize.toString()
		}, {
			label: '' // line separator
		}
		];
		if (profile.activeDirectorySupported) {
			descriptions.push({
				label: localize('deployCluster.activeDirectoryAuthentication', "Active Directory authentication"),
				value: '✅'
			});
		} else {
			descriptions.push({
				label: localize('deployCluster.basicAuthentication', "Basic authentication"),
				value: '✅'
			});
		}

		if (profile.hadrEnabled) {
			descriptions.push({
				label: localize('deployCluster.hadr', "High Availability"),
				value: '✅'
			});
		}

		const card = view.modelBuilder.card().withProperties<azdata.CardProperties>({
			cardType: azdata.CardType.VerticalButton,
			label: profile.profileName,
			descriptions: descriptions,
			width: '240px',
			height: '300px',
		}).component();
		this._cards.push(card);
		this.wizard.registerDisposable(card.onCardSelectedChanged(() => {
			if (card.selected) {
				this.wizard.wizardObject.message = { text: '' };
				this.setModelValuesByProfile(profile);
				// clear the selected state of the previously selected card
				this._cards.forEach(c => {
					if (c !== card) {
						c.selected = false;
					}
				});
			} else {
				// keep the selected state if no other card is selected
				if (this._cards.filter(c => { return c !== card && c.selected; }).length === 0) {
					card.selected = true;
				}
			}
		}));

		return card;
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
		this.wizard.model.setPropertyValue(VariableNames.EnableHADR_VariableName, selectedProfile.hadrEnabled);
		this.wizard.model.setPropertyValue(VariableNames.SQLServerPort_VariableName, selectedProfile.sqlServerPort);
		this.wizard.model.setPropertyValue(VariableNames.GateWayPort_VariableName, selectedProfile.gatewayPort);
		this.wizard.model.setPropertyValue(VariableNames.ControllerPort_VariableName, selectedProfile.controllerPort);
		this.wizard.model.setPropertyValue(VariableNames.IncludeSpark_VariableName, selectedProfile.includeSpark);
		this.wizard.model.setPropertyValue(VariableNames.ControllerDataStorageClassName_VariableName, selectedProfile.controllerDataStorageClass);
		this.wizard.model.setPropertyValue(VariableNames.ControllerLogsStorageClassName_VariableName, selectedProfile.controllerLogsStorageClass);
		this.wizard.model.setPropertyValue(VariableNames.ReadableSecondaryPort_VariableName, selectedProfile.sqlServerReadableSecondaryPort);
		this.wizard.model.adAuthSupported = selectedProfile.activeDirectorySupported;
		this.wizard.model.selectedProfile = selectedProfile;
	}

	private loadCards(): Promise<void> {
		return this.wizard.azdataService.getDeploymentProfiles().then((profiles: BigDataClusterDeploymentProfile[]) => {
			const defaultProfile: string = this.getDefaultProfile();

			profiles.forEach(profile => {
				const card = this.createProfileCard(profile, this._view!);
				if (profile.profileName === defaultProfile) {
					card.selected = true;
					this.setModelValuesByProfile(profile);
				}
				this._cardContainer!.addItem(card, { flex: '0 0 auto' });
			});
		});
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
