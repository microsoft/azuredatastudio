/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as azdata from 'azdata';
import { Model } from '../model';

export class DeployAzureSQLVMWizardModel extends Model {
	public azureAccount!: azdata.Account;
	public securityToken!: any;
	public azureSubscription!: string;
	public azureResouceGroup!: string;
	public azureRegion!: string;

	public vmName!: string;
	public vmUsername!: string;
	public vmPassword!: string;
	public vmImage!: string;
	public vmImageSKU!: string;
	public vmImageVersion!: string;
	public vmSize!: string;

	public virtualNetworkName!: string;
	public publicIPName!: string;
	public allowRDP!: 'True' | 'False';

	public storageAccountName!: string;
	public storageAccountSKU!: string;



	constructor() {
		super();
	}



	public getCodeCellContentForNotebook(): string[] {
		const statements: string[] = [];
		statements.push(`azure_sqlvm_nb_var_subscription = '${this.azureSubscription}'`);
		statements.push(`azure_sqlvm_nb_var_resource_group_name = '${this.azureResouceGroup}'`);
		statements.push(`azure_sqlvm_location = '${this.azureRegion}'`);
		statements.push(`azure_sqlvm_vmname = '${this.vmName}'`);
		statements.push(`azure_sqlvm_image = '${this.vmImage}'`);
		statements.push(`azure_sqlvm_image_sku = '${this.vmImageSKU}'`);
		statements.push(`azure_sqlvm_image_version = '${this.vmImageVersion}'`);
		statements.push(`azure_sqlvm_vmsize = '${this.vmSize}'`);
		statements.push(`azure_sqlvm_storageaccountname = '${this.storageAccountName}'`);
		statements.push(`azure_sqlvm_storagesku = '${this.storageAccountSKU}'`);
		statements.push(`azure_sqlvm_username = '${this.vmUsername}'`);
		return statements.map(line => line + EOL);
		// const profile = this.createTargetProfile();
		// const statements: string[] = [];
		// if (this.deploymentTarget === BdcDeploymentType.NewAKS) {
		// 	statements.push(`azure_subscription_id = '${this.getStringValue(VariableNames.SubscriptionId_VariableName, '')}'`);
		// 	statements.push(`azure_region = '${this.getStringValue(VariableNames.Location_VariableName)}'`);
		// 	statements.push(`azure_resource_group = '${this.getStringValue(VariableNames.ResourceGroup_VariableName)}'`);
		// 	statements.push(`azure_vm_size = '${this.getStringValue(VariableNames.VMSize_VariableName)}'`);
		// 	statements.push(`azure_vm_count = '${this.getStringValue(VariableNames.VMCount_VariableName)}'`);
		// 	statements.push(`aks_cluster_name = '${this.getStringValue(VariableNames.AksName_VariableName)}'`);
		// } else if (this.deploymentTarget === BdcDeploymentType.ExistingAKS
		// 	|| this.deploymentTarget === BdcDeploymentType.ExistingKubeAdm
		// 	|| this.deploymentTarget === BdcDeploymentType.ExistingARO
		// 	|| this.deploymentTarget === BdcDeploymentType.ExistingOpenShift) {
		// 	statements.push(`mssql_kube_config_path = '${this.escapeForNotebookCodeCell(this.getStringValue(VariableNames.KubeConfigPath_VariableName)!)}'`);
		// 	statements.push(`mssql_cluster_context = '${this.getStringValue(VariableNames.ClusterContext_VariableName)}'`);
		// 	statements.push('os.environ["KUBECONFIG"] = mssql_kube_config_path');
		// }
		// if (this.authenticationMode === AuthenticationMode.ActiveDirectory) {
		// 	statements.push(`mssql_domain_service_account_username = '${this.escapeForNotebookCodeCell(this.getStringValue(VariableNames.DomainServiceAccountUserName_VariableName)!)}'`);
		// }
		// statements.push(`mssql_cluster_name = '${this.getStringValue(VariableNames.ClusterName_VariableName)}'`);
		// statements.push(`mssql_username = '${this.getStringValue(VariableNames.AdminUserName_VariableName)}'`);
		// statements.push(`mssql_auth_mode = '${this.authenticationMode}'`);
		// statements.push(`bdc_json = '${profile.getBdcJson(false)}'`);
		// statements.push(`control_json = '${profile.getControlJson(false)}'`);
		// if (this.getStringValue(VariableNames.DockerUsername_VariableName) && this.getStringValue(VariableNames.DockerPassword_VariableName)) {
		// 	statements.push(`os.environ["DOCKER_USERNAME"] = '${this.getStringValue(VariableNames.DockerUsername_VariableName)}'`);
		// 	statements.push(`os.environ["DOCKER_PASSWORD"] = os.environ["${VariableNames.DockerPassword_VariableName}"]`);
		// }
		// const kubeCtlEnvVarName: string = getRuntimeBinaryPathEnvironmentVariableName(KubeCtlToolName);
		// const env: NodeJS.ProcessEnv = {};
		// setEnvironmentVariablesForInstallPaths(tools, env);
		// statements.push(`os.environ["${kubeCtlEnvVarName}"] = "${this.escapeForNotebookCodeCell(env[kubeCtlEnvVarName]!)}"`);
		// statements.push(`os.environ["PATH"] = os.environ["PATH"] + "${delimiter}" + "${this.escapeForNotebookCodeCell(env[ToolsInstallPath]!)}"`);
		// statements.push(`print('Variables have been set successfully.')`);
		// return statements.map(line => line + EOL);
		// return [];
	}
}
