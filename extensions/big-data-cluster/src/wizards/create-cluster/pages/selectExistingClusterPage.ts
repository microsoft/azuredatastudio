/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterWizard } from '../createClusterWizard';
import { setActiveKubeconfig } from '../../../config/config';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
const ClusterRadioButtonGroupName = 'cluster';

export class SelectExistingClusterPage extends WizardPageBase<CreateClusterWizard> {
	private existingClusterControl: azdata.FlexContainer;
	private clusterContextsLabel: azdata.TextComponent;
	private errorLoadingClustersLabel: azdata.TextComponent;
	private clusterContextContainer: azdata.DivContainer;
	private clusterContextLoadingComponent: azdata.LoadingComponent;
	private configFileInput: azdata.InputBoxComponent;
	private browseFileButton: azdata.ButtonComponent;
	private loadDefaultKubeConfigFile: boolean = true;
	private view: azdata.ModelView;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.selectTargetClusterPageTitle', 'Where do you want to deploy this SQL Server big data cluster?'),
			localize('bdc-create.selectTargetClusterPageDescription', 'Select the kubeconfig file and then select a cluster context from the list'),
			wizard);
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		this.view = view;
		this.initExistingClusterControl();
		let formBuilder = view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: this.existingClusterControl,
					title: ''
				}
			],
			{
				horizontal: false
			}
		).withLayout({ width: '100%', height: '100%' });

		let form = formBuilder.component();
		return view.initializeModel(form);
	}

	public onEnter() {
		if (this.loadDefaultKubeConfigFile) {
			let defaultKubeConfigPath = this.wizard.model.getDefaultKubeConfigPath();
			if (fs.existsSync(defaultKubeConfigPath)) {
				this.loadClusterContexts(defaultKubeConfigPath);
			}
			this.loadDefaultKubeConfigFile = false;
		}

		this.wizard.wizardObject.registerNavigationValidator((e) => {
			if (e.lastPage > e.newPage) {
				this.wizard.wizardObject.message = null;
				return true;
			}
			let clusterSelected = this.wizard.model.selectedCluster !== undefined;
			if (!clusterSelected) {
				this.wizard.wizardObject.message = {
					text: localize('bdc-create.ClusterContextNotSelectedMessage', 'Please select a cluster context.'),
					level: azdata.window.MessageLevel.Error
				};
			}
			return clusterSelected;
		});
	}

	private initExistingClusterControl(): void {
		let self = this;
		let configFileLabel = this.view.modelBuilder.text().withProperties({ value: localize('bdc-create.kubeConfigFileLabelText', 'Kube config file path') }).component();
		this.configFileInput = this.view.modelBuilder.inputBox().withProperties({ width: '300px' }).component();
		this.configFileInput.enabled = false;
		this.browseFileButton = this.view.modelBuilder.button().withProperties({ label: localize('bdc-browseText', 'Browse'), width: '100px' }).component();
		let configFileContainer = this.view.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([configFileLabel, this.configFileInput, this.browseFileButton], { CSSStyles: { 'margin-right': '10px' } }).component();
		this.clusterContextsLabel = this.view.modelBuilder.text().withProperties({ value: localize('bdc-clusterContextsLabelText', 'Cluster Contexts') }).component();
		this.errorLoadingClustersLabel = this.view.modelBuilder.text().withProperties({ value: localize('bdc-errorLoadingClustersText', 'No cluster information is found in the config file or an error ocurred while loading the config file') }).component();
		this.clusterContextContainer = this.view.modelBuilder.divContainer().component();
		this.clusterContextLoadingComponent = this.view.modelBuilder.loadingComponent().withItem(this.clusterContextContainer).component();
		this.existingClusterControl = this.view.modelBuilder.divContainer().withItems([configFileContainer, this.clusterContextLoadingComponent], { CSSStyles: { 'margin-top': '0px' } }).component();

		this.browseFileButton.onDidClick(async () => {
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

			self.loadClusterContexts(fileUri.fsPath);
		});
	}

	private async loadClusterContexts(configPath: string): Promise<void> {
		this.clusterContextLoadingComponent.loading = true;
		let self = this;
		this.configFileInput.value = configPath;
		await setActiveKubeconfig(configPath);

		let clusters = await this.wizard.model.loadClusters();
		if (clusters.length !== 0) {
			let options = clusters.map(cluster => {
				let option = this.view.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
					label: cluster.contextName,
					checked: cluster.active,
					name: ClusterRadioButtonGroupName
				}).component();

				if (cluster.active) {
					self.wizard.model.selectedCluster = cluster;
					self.wizard.wizardObject.message = null;
				}

				option.onDidClick(() => {
					self.wizard.model.selectedCluster = cluster;
					self.wizard.wizardObject.message = null;
				});
				return option;
			});

			self.clusterContextContainer.addItem(self.clusterContextsLabel);
			self.clusterContextContainer.addItems(options);
		} else {
			self.clusterContextContainer.addItem(this.errorLoadingClustersLabel);
		}
		this.clusterContextLoadingComponent.loading = false;
	}
}