/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { WizardPageBase } from '../../wizardPageBase';
import { DeploymentProfile } from '../../../services/azdataService';
const localize = nls.loadMessageBundle();

export class DeploymentProfilePage extends WizardPageBase<DeployClusterWizard> {

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.summaryPageTitle', "Deployment profile"), '', wizard);
	}

	protected initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			return this.wizard.azdataService.getDeploymentProfiles().then((profiles) => {
				const profilesContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', flexWrap: 'wrap' }).component();
				profiles.forEach(profile => {
					const card = this.createProfileCard(profile, view);
					profilesContainer.addItem(card, { flex: '0 0 auto' });

				});
				let formBuilder = view.modelBuilder.formContainer().withFormItems(
					[
						{
							title: '',
							component: profilesContainer
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
		const profileContainer = view.modelBuilder.card().withProperties<azdata.CardProperties>({
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
		return profileContainer;
	}
}
