/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as os from 'os';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { DeployClusterWizard } from '../deployClusterWizard';
import { WizardPageBase } from '../../wizardPageBase';
import { KubeClusterContext } from '../../../services/kubeService';
import { ClusterContext_VariableName, KubeConfigPath_VariableName } from '../constants';
const localize = nls.loadMessageBundle();

const ClusterRadioButtonGroupName = 'ClusterRadioGroup';

export class TargetClusterContextPage extends WizardPageBase<DeployClusterWizard> {
	private existingClusterControl: azdata.FlexContainer | undefined;
	private clusterContextsLabel: azdata.TextComponent | undefined;
	private errorLoadingClustersLabel: azdata.TextComponent | undefined;
	private clusterContextList: azdata.DivContainer | undefined;
	private clusterContextLoadingComponent: azdata.LoadingComponent | undefined;
	private configFileInput: azdata.InputBoxComponent | undefined;
	private browseFileButton: azdata.ButtonComponent | undefined;
	private loadDefaultKubeConfigFile: boolean = true;
	private view: azdata.ModelView | undefined;

	constructor(wizard: DeployClusterWizard) {
		super(localize('deployCluster.TargetClusterContextPageTitle', "Target cluster context"),
			localize('deployCluster.TargetClusterContextPageDescription', "Select the kube config file and then select a cluster context from the list"), wizard);
	}

	public initialize(): void {
		this.pageObject.registerContent((view: azdata.ModelView) => {
			this.view = view;
			this.initExistingClusterControl();
			let formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: this.existingClusterControl!,
						title: ''
					}
				],
				{
					horizontal: false
				}
			).withLayout({ width: '100%', height: '100%' });
			const form = formBuilder.withLayout({ width: '100%' }).component();
			return view.initializeModel(form);
		});
	}

	public async onEnter(): Promise<void> {
		if (this.loadDefaultKubeConfigFile) {
			let defaultKubeConfigPath = this.wizard.kubeService.getDefaultConfigPath();
			this.loadClusterContexts(defaultKubeConfigPath);
			this.loadDefaultKubeConfigFile = false;
		}

		this.wizard.wizardObject.registerNavigationValidator((e) => {
			if (e.lastPage > e.newPage) {
				this.wizard.wizardObject.message = { text: '' };
				return true;
			}
			let clusterSelected = this.wizard.model.getStringValue(ClusterContext_VariableName) !== undefined;
			if (!clusterSelected) {
				this.wizard.wizardObject.message = {
					text: localize('deployCluster.ClusterContextNotSelectedMessage', "Please select a cluster context."),
					level: azdata.window.MessageLevel.Error
				};
			}
			return clusterSelected;
		});
	}

	public onLeave() {
		this.wizard.wizardObject.registerNavigationValidator((e) => {
			return true;
		});
	}

	private initExistingClusterControl(): void {
		let self = this;
		const labelWidth = '150px';
		let configFileLabel = this.view!.modelBuilder.text().withProperties({ value: localize('deployCluster.kubeConfigFileLabelText', "Kube config file path") }).component();
		configFileLabel.width = labelWidth;
		this.configFileInput = this.view!.modelBuilder.inputBox().withProperties({ width: '300px' }).component();
		this.configFileInput.enabled = false;
		this.browseFileButton = this.view!.modelBuilder.button().withProperties({ label: localize('deployCluster.browseText', "Browse"), width: '100px' }).component();
		let configFileContainer = this.view!.modelBuilder.flexContainer()
			.withLayout({ flexFlow: 'row', alignItems: 'baseline' })
			.withItems([configFileLabel, this.configFileInput, this.browseFileButton], { CSSStyles: { 'margin-right': '10px' } }).component();
		this.clusterContextsLabel = this.view!.modelBuilder.text().withProperties({ value: localize('deployCluster.clusterContextsLabelText', "Cluster Contexts") }).component();
		this.clusterContextsLabel.width = labelWidth;
		this.errorLoadingClustersLabel = this.view!.modelBuilder.text().withProperties({ value: localize('deployCluster.errorLoadingClustersText', "No cluster information is found in the config file or an error ocurred while loading the config file") }).component();
		this.clusterContextList = this.view!.modelBuilder.divContainer().component();
		this.clusterContextLoadingComponent = this.view!.modelBuilder.loadingComponent().withItem(this.clusterContextList).component();
		this.existingClusterControl = this.view!.modelBuilder.divContainer().withProperties<azdata.DivContainerProperties>({ clickable: false }).component();
		let clusterContextContainer = this.view!.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'start' }).component();
		clusterContextContainer.addItem(this.clusterContextsLabel, { flex: '0 0 auto' });
		clusterContextContainer.addItem(this.clusterContextLoadingComponent, { flex: '0 0 auto', CSSStyles: { 'width': '400px', 'margin-left': '10px', 'margin-top': '10px' } });

		this.existingClusterControl.addItem(configFileContainer, { CSSStyles: { 'margin-top': '0px' } });
		this.existingClusterControl.addItem(clusterContextContainer, {
			CSSStyles: { 'margin- top': '10px' }
		});

		this.wizard.registerDisposable(this.browseFileButton.onDidClick(async () => {
			let fileUris = await vscode.window.showOpenDialog(
				{
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri: vscode.Uri.file(os.homedir()),
					openLabel: localize('deployCluster.selectKubeConfigFileText', "Select"),
					filters: {
						'Config Files': ['*'],
					}
				}
			);

			if (!fileUris || fileUris.length === 0) {
				return;
			}
			self.clusterContextList!.clearItems();

			let fileUri = fileUris[0];

			self.loadClusterContexts(fileUri.fsPath);
		}));
	}

	private async loadClusterContexts(configPath: string): Promise<void> {
		this.clusterContextLoadingComponent!.loading = true;
		this.wizard.model.setPropertyValue(ClusterContext_VariableName, undefined);
		this.wizard.wizardObject.message = { text: '' };
		let self = this;
		this.configFileInput!.value = configPath;

		let clusterContexts: KubeClusterContext[] = [];
		try {
			clusterContexts = await this.wizard.kubeService.getClusterContexts(configPath);
		} catch (error) {
			this.wizard.wizardObject.message = {
				text: localize('deployCluster.ConfigParseError', "Failed to load the config file"),
				description: error.message || error, level: azdata.window.MessageLevel.Error
			};
		}
		if (clusterContexts.length !== 0) {
			self.wizard.model.setPropertyValue(KubeConfigPath_VariableName, configPath);
			let options = clusterContexts.map(clusterContext => {
				let option = this.view!.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
					label: clusterContext.name,
					checked: clusterContext.isCurrentContext,
					name: ClusterRadioButtonGroupName
				}).component();

				if (clusterContext.isCurrentContext) {
					self.wizard.model.setPropertyValue(ClusterContext_VariableName, clusterContext.name);
					self.wizard.wizardObject.message = { text: '' };
				}

				this.wizard.registerDisposable(option.onDidClick(() => {
					self.wizard.model.setPropertyValue(ClusterContext_VariableName, clusterContext.name);
					self.wizard.wizardObject.message = { text: '' };
				}));
				return option;
			});
			self.clusterContextList!.addItems(options);
		} else {
			self.clusterContextList!.addItem(this.errorLoadingClustersLabel!);
		}
		this.clusterContextLoadingComponent!.loading = false;
	}
}
