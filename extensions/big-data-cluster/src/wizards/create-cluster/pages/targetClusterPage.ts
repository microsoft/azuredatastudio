/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import * as os from 'os';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterModel } from '../createClusterModel';
import * as ResourceStrings from '../resourceStrings';
import { WizardBase } from '../../wizardBase';
import { TargetClusterType } from '../../../data/targetClusterType';

const ClusterTypeRadioButtonGroupName = 'SelectClusterType';

export class SelectTargetClusterPage extends WizardPageBase<CreateClusterModel> {
	constructor(model: CreateClusterModel, wizard: WizardBase<CreateClusterModel>) {
		super(ResourceStrings.SelectTargetClusterPageTitle, ResourceStrings.SelectTargetClusterPageDescription, model, wizard);
	}

	private existingClusterOption: sqlops.RadioButtonComponent;
	private createLocalClusterOption: sqlops.RadioButtonComponent;
	private createAksClusterOption: sqlops.RadioButtonComponent;
	private pageContainer: sqlops.DivContainer;
	private existingClusterControl: sqlops.FlexContainer;
	private createLocalclusterControl: sqlops.FlexContainer;
	private createAksClusterControl: sqlops.FlexContainer;
	private clusterContextsLabel: sqlops.TextComponent;
	private errorLoadingClustersLabel: sqlops.TextComponent;
	private clusterContextContainer: sqlops.DivContainer;

	private cards: sqlops.CardComponent[];

	protected async initialize(view: sqlops.ModelView) {
		let self = this;
		this.model.targetClusterType = TargetClusterType.ExistingKubernetesCluster;
		this.existingClusterOption = this.createTargetTypeRadioButton(view, ResourceStrings.ExistingClusterOptionText, true);
		this.createLocalClusterOption = this.createTargetTypeRadioButton(view, ResourceStrings.CreateLocalClusterOptionText);
		this.createAksClusterOption = this.createTargetTypeRadioButton(view, ResourceStrings.CreateNewAKSClusterOptionText);

		this.existingClusterOption.onDidClick(() => {
			self.pageContainer.clearItems();
			self.pageContainer.addItem(self.existingClusterControl);
			self.model.targetClusterType = TargetClusterType.ExistingKubernetesCluster;
		});

		this.createLocalClusterOption.onDidClick(() => {
			self.pageContainer.clearItems();
			self.pageContainer.addItem(self.createLocalclusterControl);
			self.model.targetClusterType = TargetClusterType.NewLocalCluster;
		});

		this.createAksClusterOption.onDidClick(() => {
			self.pageContainer.clearItems();
			self.pageContainer.addItem(self.createAksClusterControl);
			self.model.targetClusterType = TargetClusterType.NewAksCluster;
		});

		let optionGroup = view.modelBuilder.divContainer().withItems([this.existingClusterOption, this.createLocalClusterOption, this.createAksClusterOption],
			{ CSSStyles: { 'margin-right': '30px' } }).withLayout({ width: 'auto' }).component();
		this.initExistingClusterControl(view);
		this.initLocalClusterControl(view);
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
		await view.initializeModel(form);
	}

	private createTargetTypeRadioButton(view: sqlops.ModelView, label: string, checked: boolean = false): sqlops.RadioButtonComponent {
		return view.modelBuilder.radioButton().withProperties({ label: label, name: ClusterTypeRadioButtonGroupName, checked: checked }).component();
	}

	private initExistingClusterControl(view: sqlops.ModelView) {
		let self = this;
		let sectionDescription = view.modelBuilder.text().withProperties({ value: ResourceStrings.ExistingClusterSectionDescription }).component();
		let configFileLabel = view.modelBuilder.text().withProperties({ value: ResourceStrings.KubeConfigFileLabelText }).component();
		let configFileInput = view.modelBuilder.inputBox().withProperties({ width: '300px' }).component();
		let browseFileButton = view.modelBuilder.button().withProperties({ label: ResourceStrings.BrowseText, width: '100px' }).component();
		let configFileContainer = view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([configFileLabel, configFileInput, browseFileButton], { CSSStyles: { 'margin-right': '10px' } }).component();
		this.clusterContextsLabel = view.modelBuilder.text().withProperties({ value: ResourceStrings.ClusterContextsLabelText }).component();
		this.errorLoadingClustersLabel = view.modelBuilder.text().withProperties({ value: ResourceStrings.ErrorLoadingClustersFromConfigText }).component();
		this.clusterContextContainer = view.modelBuilder.divContainer().component();
		this.existingClusterControl = view.modelBuilder.divContainer().withItems([sectionDescription, configFileContainer, this.clusterContextContainer], { CSSStyles: { 'margin-top': '0px' } }).component();

		browseFileButton.onDidClick(async () => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(os.homedir()),
					openLabel: ResourceStrings.SelectKubeConfigFileText,
					filters: {
						'KubeConfig Files': ['kubeconfig'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}
			self.clusterContextContainer.clearItems();

			let fileUri = fileUris[0];

			configFileInput.value = fileUri.fsPath;

			let clusters = self.model.loadClusters(fileUri.fsPath);

			self.cards = [];
			if (clusters.length !== 0) {
				self.model.selectedCluster = clusters[0];
				for (let i = 0; i < clusters.length; i++) {
					let cluster = clusters[i];
					let card = view.modelBuilder.card().withProperties({
						selected: i === 0,
						label: cluster.name,
						descriptions: [cluster.displayName, cluster.user],
						cardType: sqlops.CardType.ListItem,
						iconPath: {
							dark: self.Wizard.context.asAbsolutePath('images/cluster_inverse.svg'),
							light: self.Wizard.context.asAbsolutePath('images/cluster.svg')
						},
					}).component();
					card.onCardSelectedChanged(() => {
						if (card.selected) {
							self.cards.forEach(c => {
								if (c !== card) {
									c.selected = false;
								}
							});
							self.model.selectedCluster = cluster;
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

	private initLocalClusterControl(view: sqlops.ModelView) {
		let placeholder = view.modelBuilder.text().withProperties({ value: 'create local cluster place holder' }).component();
		this.createLocalclusterControl = view.modelBuilder.divContainer().withItems([placeholder]).component();
	}

	private initAksClusterControl(view: sqlops.ModelView) {
		let placeholder = view.modelBuilder.text().withProperties({ value: 'AKS cluster place holder' }).component();
		this.createAksClusterControl = view.modelBuilder.divContainer().withItems([placeholder]).component();
	}
}
