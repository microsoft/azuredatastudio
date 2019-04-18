/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { WizardPageBase } from '../../wizardPageBase';
import { CreateClusterWizard } from '../createClusterWizard';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();
const LabelWidth = '250px';

export class SummaryPage extends WizardPageBase<CreateClusterWizard> {
	private view: azdata.ModelView;
	private targetTypeText: azdata.TextComponent;
	private targetClusterContextText: azdata.TextComponent;
	private clusterNameText: azdata.TextComponent;
	private clusterAdminUsernameText: azdata.TextComponent;
	private acceptEulaText: azdata.TextComponent;
	private deploymentProfileText: azdata.TextComponent;
	private sqlServerMasterScaleText: azdata.TextComponent;
	private storagePoolScaleText: azdata.TextComponent;
	private computePoolScaleText: azdata.TextComponent;
	private dataPoolScaleText: azdata.TextComponent;
	private sparkPoolScaleText: azdata.TextComponent;

	constructor(wizard: CreateClusterWizard) {
		super(localize('bdc-create.summaryPageTitle', 'Summary'), '', wizard);
	}

	protected initialize(view: azdata.ModelView): Thenable<void> {
		this.view = view;
		let targetClusterInfoGroup = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		let bdcClusterInfoGroup = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
		this.targetTypeText = this.view.modelBuilder.text().component();
		this.targetClusterContextText = this.view.modelBuilder.text().component();
		this.clusterNameText = this.view.modelBuilder.text().component();
		this.clusterAdminUsernameText = this.view.modelBuilder.text().component();
		this.acceptEulaText = this.view.modelBuilder.text().component();
		this.deploymentProfileText = this.view.modelBuilder.text().component();
		this.sqlServerMasterScaleText = this.view.modelBuilder.text().component();
		this.storagePoolScaleText = this.view.modelBuilder.text().component();
		this.computePoolScaleText = this.view.modelBuilder.text().component();
		this.dataPoolScaleText = this.view.modelBuilder.text().component();
		this.sparkPoolScaleText = this.view.modelBuilder.text().component();
		targetClusterInfoGroup.addItem(this.createRow(localize('bdc-create.TargetClusterTypeText', 'Cluster type'), this.targetTypeText));
		targetClusterInfoGroup.addItem(this.createRow(localize('bdc-create.ClusterContextText', 'Cluster context'), this.targetClusterContextText));

		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.ClusterNameText', 'Cluster name'), this.clusterNameText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.ClusterAdminUsernameText', 'Cluster Admin username'), this.clusterAdminUsernameText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.AcceptEulaText', 'Accept license agreement'), this.acceptEulaText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.DeploymentProfileText', 'Deployment profile'), this.deploymentProfileText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.SqlServerMasterScaleText', 'SQL Server master scale'), this.sqlServerMasterScaleText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.ComputePoolScaleText', 'Compute pool scale'), this.computePoolScaleText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.DataPoolScaleText', 'Data pool scale'), this.dataPoolScaleText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.StoragePoolScaleText', 'Storage pool scale'), this.storagePoolScaleText));
		bdcClusterInfoGroup.addItem(this.createRow(localize('bdc-create.SparkPoolScaleText', 'Spark pool scale'), this.sparkPoolScaleText));

		let formBuilder = view.modelBuilder.formContainer();
		let form = formBuilder.withFormItems([{
			title: localize('bdc-create.TargetClusterGroupTitle', 'TARGET CLUSTER'),
			component: targetClusterInfoGroup
		}, {
			title: localize('bdc-create.BigDataClusterGroupTitle', 'SQL SERVER BIG DATA CLUSTER'),
			component: bdcClusterInfoGroup
		}]).component();

		return view.initializeModel(form);
	}

	public onEnter(): void {
		this.wizard.model.getAllTargetClusterTypeInfo().then((clusterTypes) => {
			let selectedClusterType = clusterTypes.filter(clusterType => clusterType.type === this.wizard.model.targetClusterType)[0];
			this.targetTypeText.value = selectedClusterType.fullName;
			this.targetClusterContextText.value = this.wizard.model.selectedCluster.contextName;
			this.clusterNameText.value = this.wizard.model.clusterName;
			this.clusterAdminUsernameText.value = this.wizard.model.adminUserName;
			this.acceptEulaText.value = localize('bdc-create.YesText', 'Yes');
			this.deploymentProfileText.value = this.wizard.model.profile.name;
			this.sqlServerMasterScaleText.value = this.wizard.model.profile.sqlServerMasterConfiguration.scale.toString();
			this.computePoolScaleText.value = this.wizard.model.profile.computePoolConfiguration.scale.toString();
			this.dataPoolScaleText.value = this.wizard.model.profile.dataPoolConfiguration.scale.toString();
			this.storagePoolScaleText.value = this.wizard.model.profile.storagePoolConfiguration.scale.toString();
			this.sparkPoolScaleText.value = this.wizard.model.profile.sparkPoolConfiguration.scale.toString();

		});
		this.wizard.wizardObject.generateScriptButton.hidden = false;
	}

	public onLeave(): void {
		this.wizard.wizardObject.generateScriptButton.hidden = true;
	}

	private createRow(label: string, textComponent: azdata.TextComponent): azdata.FlexContainer {
		let row = this.view.modelBuilder.flexContainer().withLayout({ flexFlow: 'row', alignItems: 'baseline' }).component();
		let labelComponent = this.view.modelBuilder.text().withProperties({ value: label }).component();
		labelComponent.width = LabelWidth;
		textComponent.width = LabelWidth;
		row.addItems([labelComponent, textComponent]);
		return row;
	}
}
