/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterWizard } from '../createClusterWizard';
import * as nls from 'vscode-nls';
import { ClusterProfile } from '../../../interfaces';


const localize = nls.loadMessageBundle();

export class ClusterProfilePage extends WizardPageBase<CreateClusterWizard> {
	private view: azdata.ModelView;
	private clusterProfiles: ClusterProfile[];
	private poolList: azdata.FlexContainer;
	private detailContainer: azdata.FlexContainer;
	private clusterResourceView: azdata.GroupContainer;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.clusterProfilePageTitle', 'Select a cluster profile'),
			localize('bdc-create.clusterProfilePageDescription', 'Select your requirement and we will provide you a pre-defined default scaling. You can later go to cluster configuration and customize it.'),
			wizard);
	}

	public onEnter(): void {
		this.wizard.wizardObject.registerNavigationValidator(() => {
			return true;
		});
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		this.view = view;
		let fetchProfilePromise = this.wizard.model.getProfiles().then(p => { this.clusterProfiles = p; });
		return Promise.all([fetchProfilePromise]).then(() => {
			this.clusterResourceView = this.view.modelBuilder.groupContainer().withLayout({
				header: localize('bdc-create.TargetClusterOverview', 'Target cluster scale overview'),
				collapsed: true,
				collapsible: true
			}).component();

			let profileLabel = view.modelBuilder.text().withProperties({ value: localize('bdc-create.clusterProfileLabel', 'Deployment profile') }).component();
			let profileDropdown = view.modelBuilder.dropDown().withProperties<azdata.DropDownProperties>({
				values: this.clusterProfiles.map(profile => profile.name),
				width: '300px'
			}).component();
			let dropdownRow = this.view.modelBuilder.flexContainer().withItems([profileLabel, profileDropdown], { CSSStyles: { 'margin-right': '30px' } }).withLayout({ flexFlow: 'row', alignItems: 'center' }).component();
			let poolContainer = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', width: '100%' }).component();
			this.poolList = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '300px', height: '790px' }).component();
			poolContainer.addItem(this.poolList, {
				flex: '0 0 0',
				CSSStyles: {
					'border-top-style': 'solid',
					'border-top-width': '2px',
					'border-right-style': 'solid',
					'border-right-width': '2px',
					'border-color': 'lightgray'
				}
			});

			this.detailContainer = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column', width: '760px', height: '800px' }).component();
			poolContainer.addItem(this.detailContainer, {
				flex: '1 1 0',
				CSSStyles: {
					'border-top-style': 'solid',
					'border-top-width': '2px',
					'border-color': 'lightgray'
				}
			});

			profileDropdown.onValueChanged(() => {
				let profiles = this.clusterProfiles.filter(p => profileDropdown.value === p.name);
				if (profiles && profiles.length === 1) {
					this.populatePoolList(profiles[0]);
					this.wizard.model.profile = profiles[0];
				}
			});

			this.populatePoolList(this.clusterProfiles[0]);
			let formBuilder = view.modelBuilder.formContainer();
			let form = formBuilder.withFormItems([{
				title: '',
				component: this.clusterResourceView
			}, {
				title: '',
				component: dropdownRow
			}, {
				title: '',
				component: poolContainer
			}], {
					horizontal: false,
					componentWidth: '100%'
				}).component();

			return view.initializeModel(form);
		});
	}

	private populatePoolList(profile: ClusterProfile): void {
		this.poolList.clearItems();
		profile.pools.forEach(pool => {
			let poolSummaryButton = this.view.modelBuilder.divContainer().component();
			let container = this.view.modelBuilder.flexContainer().component();
			poolSummaryButton.onDidClick(() => {
				this.detailContainer.clearItems();
				this.detailContainer.addItem(this.view.modelBuilder.text().withProperties({ value: 'pool detail is not implemented yet' }).component());
			});
			let text = this.view.modelBuilder.text().withProperties<azdata.TextComponentProperties>({
				value: localize({
					key: 'bdc-create.poolLabelTemplate',
					comment: ['{0} is the pool name, {1} is the scale number']
				}, '{0} ({1})', pool.name, pool.scale),
			}).component();
			text.width = '250px';
			let chrevron = this.view.modelBuilder.text().withProperties({ value: '>' }).component();
			chrevron.width = '30px';
			container.addItem(text);
			container.addItem(chrevron, {
				CSSStyles: {
					'font-size': '20px',
					'line-height': '0px'
				}
			});
			poolSummaryButton.addItem(container);
			this.poolList.addItem(poolSummaryButton, {
				CSSStyles: {
					'border-bottom-style': 'solid',
					'border-bottom-width': '1px',
					'border-color': 'lightgray',
					'cursor': 'pointer'
				}
			});
		});
	}
}
