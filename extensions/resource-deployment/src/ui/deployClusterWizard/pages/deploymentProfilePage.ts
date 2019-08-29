/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { WizardPageBase } from '../../wizardPageBase';
import { DeploymentProfile } from '../../../services/azdataService';
import { DeploymentProfile_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

export class DeploymentProfilePage extends WizardPageBase<DeployClusterWizard> {

	private _cards: azdata.CardComponent[] = [];

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Deployment profile"),
			localize('deployCluster.summaryPageDescription', "Select a deployment profile"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			return this.wizard.azdataService.getDeploymentProfiles().then((profiles) => {
				const profilesContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', flexWrap: 'wrap' }).component();
				profiles.forEach(profile => {
					const card = this.createProfileCard(profile, view);
					profilesContainer.addItem(card, { flex: '0 0 auto' });
				});
				const hintText = view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
					value: localize('deployCluster.ProfileHintText', "Note: The settings of the deployment profile can be customized in later steps.")
				}).component();
				let formBuilder = view.modelBuilder.formContainer().withFormItems(
					[
						{
							title: '',
							component: profilesContainer
						}, {
							title: '',
							component: hintText
						}
					],
					{
						horizontal: false
					}
				).withLayout({ width: '100%', height: '100%' });
				const form = formBuilder.withLayout({ width: '100%' }).component();
				return view.initializeModel(form);
			});
		});
	}

	private createProfileCard(profile: DeploymentProfile, view: azdata.ModelView): azdata.CardComponent {
		const card = view.modelBuilder.card().withProperties<azdata.CardProperties>({
			cardType: azdata.CardType.VerticalButton,
			label: profile.name,
			descriptions: [
				{
					label: localize('deployCluster.defaultDataStorage', "Data storage size"),
					value: profile.defaultDataSize.toString()
				}, {
					label: localize('deployCluster.defaultLogStorage', "Log storage size"),
					value: profile.defaultLogSize.toString()
				}, {
					label: '' // Blank line
				}, {
					label: localize('deployCluster.masterPool', "Master SQL Server"),
					value: profile.master.toString()
				}, {
					label: localize('deployCluster.computePool', "Compute"),
					value: profile.compute.toString()
				}, {
					label: localize('deployCluster.dataPool', "Data"),
					value: profile.data.toString()
				}, {
					label: localize('deployCluster.nameNode', "Name node"),
					value: profile.nameNode.toString()
				}, {
					label: localize('deployCluster.spark', "Spark"),
					value: profile.spark.toString()
				}, {
					label: localize('deployCluster.storage', "Storage"),
					value: profile.storage.toString()
				}
			],
			width: '240px',
			height: '400px'
		}).component();
		this._cards.push(card);
		this.wizard.registerDisposable(card.onCardSelectedChanged(() => {
			if (card.selected) {
				this.wizard.wizardObject.message = { text: '' };
				this.wizard.model[DeploymentProfile_VariableName] = profile.name;
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

	public onEnter() {
		this.wizard.wizardObject.registerNavigationValidator((pcInfo) => {
			this.wizard.wizardObject.message = { text: '' };
			if (pcInfo.newPage > pcInfo.lastPage) {
				const isValid = this.wizard.model[DeploymentProfile_VariableName] !== undefined;
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
}
