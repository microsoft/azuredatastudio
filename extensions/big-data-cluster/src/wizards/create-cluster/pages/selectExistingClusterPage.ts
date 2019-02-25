/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterWizard } from '../createClusterWizard';
import { TargetClusterType } from '../../../interfaces';
import { setActiveKubeconfig } from '../../../config/config';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
const ClusterTypeRadioButtonGroupName = 'SelectClusterType';

export class SelectExistingClusterPage extends WizardPageBase<CreateClusterWizard> {
	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.selectTargetClusterPageTitle', 'Where do you want to deploy this SQL Server big data cluster?'),
			localize('bdc-create.selectTargetClusterPageDescription', 'Select an existing Kubernetes cluster or choose a cluster type you want to deploy'),
			wizard);
	}

	private existingClusterOption: sqlops.RadioButtonComponent;
	private createAksClusterOption: sqlops.RadioButtonComponent;
	private pageContainer: sqlops.DivContainer;
	private existingClusterControl: sqlops.FlexContainer;
	private createAksClusterControl: sqlops.FlexContainer;
	private clusterContextsLabel: sqlops.TextComponent;
	private errorLoadingClustersLabel: sqlops.TextComponent;
	private clusterContextContainer: sqlops.DivContainer;

	private cards: sqlops.CardComponent[];

	protected initialize(view: sqlops.ModelView): Thenable<void> {
		let self = this;
		this.wizard.model.targetClusterType = TargetClusterType.ExistingKubernetesCluster;
		this.existingClusterOption = this.createTargetTypeRadioButton(view, localize('bdc-create.existingK8sCluster', 'Existing Kubernetes cluster'), true);
		this.createAksClusterOption = this.createTargetTypeRadioButton(view, localize('bdc-create.createAksCluster', 'Create new Azure Kubernetes Service cluster'));

		this.existingClusterOption.onDidClick(() => {
			self.pageContainer.clearItems();
			self.pageContainer.addItem(self.existingClusterControl);
			self.wizard.model.targetClusterType = TargetClusterType.ExistingKubernetesCluster;
		});

		this.createAksClusterOption.onDidClick(() => {
			self.pageContainer.clearItems();
			self.pageContainer.addItem(self.createAksClusterControl);
			self.wizard.model.targetClusterType = TargetClusterType.NewAksCluster;
		});

		let optionGroup = view.modelBuilder.divContainer().withItems([this.existingClusterOption, this.createAksClusterOption],
			{ CSSStyles: { 'margin-right': '30px' } }).withLayout({ width: 'auto' }).component();
		this.initExistingClusterControl(view);
		this.initAksClusterControl(view);
		this.pageContainer = view.modelBuilder.divContainer().withItems([this.existingClusterControl]).withLayout({ width: '100%' }).component();
		let container = view.modelBuilder.flexContainer().withItems([optionGroup, this.pageContainer], { flex: '0 0 auto' }).withLayout({ flexFlow: 'row', alignItems: 'left' }).component();

		let formBuilder = view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: container,
					title: ''
				}
			],
			{
				horizontal: true
			}
		).withLayout({ width: '100%', height: '100%' });

		let form = formBuilder.component();
		return view.initializeModel(form);
	}

	private createTargetTypeRadioButton(view: sqlops.ModelView, label: string, checked: boolean = false): sqlops.RadioButtonComponent {
		return view.modelBuilder.radioButton().withProperties({ label: label, name: ClusterTypeRadioButtonGroupName, checked: checked }).component();
	}

	private initExistingClusterControl(view: sqlops.ModelView): void {
		let self = this;
		let sectionDescription = view.modelBuilder.text().withProperties({ value: localize('bdc-create.existingClusterSectionDescription', 'Select the cluster context you want to install the SQL Server big data cluster') }).component();
		let configFileLabel = view.modelBuilder.text().withProperties({ value: localize('bdc-create.kubeConfigFileLabelText', 'KubeConfig File') }).component();
		let configFileInput = view.modelBuilder.inputBox().withProperties({ width: '300px' }).component();
		let browseFileButton = view.modelBuilder.button().withProperties({ label: localize('bdc-browseText', 'Browse'), width: '100px' }).component();
		let configFileContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([configFileLabel, configFileInput, browseFileButton], { CSSStyles: { 'margin-right': '10px' } }).component();
		this.clusterContextsLabel = view.modelBuilder.text().withProperties({ value: localize('bdc-clusterContextsLabelText', 'Cluster Contexts') }).component();
		this.errorLoadingClustersLabel = view.modelBuilder.text().withProperties({ value: localize('bdc-errorLoadingClustersText', 'No cluster information is found in the config file or an error ocurred while loading the config file') }).component();
		this.clusterContextContainer = view.modelBuilder.divContainer().component();
		this.existingClusterControl = view.modelBuilder.divContainer().withItems([sectionDescription, configFileContainer, this.clusterContextContainer], { CSSStyles: { 'margin-top': '0px' } }).component();

		browseFileButton.onDidClick(async () => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(os.homedir()),
					openLabel: localize('bdc-selectKubeConfigFileText', 'Select'),
					filters: {
						'KubeConfig Files': ['*'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}
			self.clusterContextContainer.clearItems();

			let fileUri = fileUris[0];

			configFileInput.value = fileUri.fsPath;
			await setActiveKubeconfig(fileUri.fsPath);

			let clusters = await self.wizard.model.loadClusters();

			self.cards = [];
			if (clusters.length !== 0) {
				self.wizard.model.selectedCluster = clusters[0];
				for (let i = 0; i < clusters.length; i++) {
					let cluster = clusters[i];
					let card = view.modelBuilder.card().withProperties({
						selected: i === 0,
						label: cluster.clusterName,
						descriptions: [cluster.clusterName, cluster.userName],
						cardType: sqlops.CardType.ListItem,
						iconPath: {
							dark: self.wizard.context.asAbsolutePath('images/cluster_inverse.svg'),
							light: self.wizard.context.asAbsolutePath('images/cluster.svg')
						},
					}).component();
					card.onCardSelectedChanged(() => {
						if (card.selected) {
							self.cards.forEach(c => {
								if (c !== card) {
									c.selected = false;
								}
							});
							self.wizard.model.selectedCluster = cluster;
						}
					});
					self.cards.push(card);
				}

				self.clusterContextContainer.addItem(self.clusterContextsLabel);
				self.clusterContextContainer.addItems(self.cards);
			} else {
				self.clusterContextContainer.addItem(this.errorLoadingClustersLabel);
			}
		});
	}

	private initAksClusterControl(view: sqlops.ModelView): void {
		let placeholder = view.modelBuilder.text().withProperties({ value: 'AKS cluster place holder' }).component();
		this.createAksClusterControl = view.modelBuilder.divContainer().withItems([placeholder]).component();
	}
}
