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
	public azureSubscriptionDisplayName!: string;
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
	public newVirtualNetwork!: 'True' | 'False';
	public subnetName!: string;
	public newSubnet!: 'True' | 'False';
	public publicIpName!: string;
	public newPublicIp!: 'True' | 'False';
	public allowRDP!: 'True' | 'False';

	public sqlConnectivityType!: string;
	public port!: number;
	public enableSqlAuthentication!: string;
	public sqlAuthenticationUsername!: string;
	public sqlAuthenticationPassword!: string;
	public sqlOptimizationDropdown!: string;


	constructor() {
		super();
	}

	public getCodeCellContentForNotebook(): string[] {

		const statements: string[] = [];

		statements.push('import os');
		statements.push(`azure_sqlvm_nb_var_subscription = '${this.azureSubscription}'`);
		statements.push(`azure_sqlvm_nb_var_resource_group_name = '${this.azureResouceGroup}'`);
		statements.push(`azure_sqlvm_location = '${this.azureRegion}'`);
		statements.push(`azure_sqlvm_vmname = '${this.vmName}'`);
		statements.push(`azure_sqlvm_username = '${this.vmUsername}'`);
		statements.push(`azure_sqlvm_image = '${this.vmImage}'`);
		statements.push(`azure_sqlvm_image_sku = '${this.vmImageSKU}'`);
		statements.push(`azure_sqlvm_image_version = '${this.vmImageVersion}'`);
		statements.push(`azure_sqlvm_vmsize = '${this.vmSize}'`);
		statements.push(`azure_sqlvm_newVirtualNetwork = ${this.newVirtualNetwork}`);
		statements.push(`azure_sqlvm_virtnet = '${this.virtualNetworkName}'`);
		statements.push(`azure_sqlvm_newSubnet = ${this.newSubnet}`);
		statements.push(`azure_sqlvm_subnet = '${this.subnetName}'`);
		statements.push(`azure_sqlvm_newPublicIp = ${this.newPublicIp}`);
		statements.push(`azure_sqlvm_publicip = '${this.publicIpName}'`);
		statements.push(`azure_sqlvm_allow_rdp = ${this.allowRDP}`);
		statements.push(`azure_sqlvm_sqlConnectivityType = '${this.sqlConnectivityType}'`);
		statements.push(`azure_sqlvm_port = '${this.port}'`);
		statements.push(`azure_sqlvm_enableSqlAuthentication = ${this.enableSqlAuthentication}`);
		statements.push(`azure_sqlvm_sqlAuthenticationUsername = '${this.sqlAuthenticationUsername}'`);

		return statements.map(line => line + EOL);
	}
}
