/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EOL } from 'os';
import * as azdata from 'azdata';
import { Model } from '../model';

export class DeployAzureSQLDBWizardModel extends Model {
	public azureAccount!: azdata.Account;
	public securityToken!: any;
	public azureSubscription!: string;
	public azureResouceGroup!: string;
	public azureRegion!: string;

	public serverName!: string;
	public serverUsername!: string;
	public serverPassword!: string;


	public virtualNetworkName!: string;
	public existingVirtualNetwork!: 'True' | 'False';
	public subnetName!: string;
	public publicIpName!: string;
	public existingPublicIp!: 'True' | 'False';
	public allowRDP!: 'True' | 'False';

	public sqlConnectivityType!: string;
	public port!: number;
	public enableSqlAuthentication!: 'True' | 'False';
	public sqlAuthenticationUsername!: string;
	public sqlAuthenticationPassword!: string;
	public sqlOptimizationDropdown!: string;

	constructor() {
		super();
	}



	public getCodeCellContentForNotebook(): string[] {
		const statements: string[] = [];

		try {
			statements.push(`azure_sqldb_nb_var_subscription = '${this.azureSubscription}'`);
			statements.push(`azure_sqldb_nb_var_resource_group_name = '${this.azureResouceGroup}'`);
			statements.push(`azure_sqldb_location = '${this.azureRegion}'`);
			statements.push(`azure_sqldb_server_name = '${this.serverName}'`);
			statements.push(`azure_sqldb_server_username = '${this.serverUsername}'`);
			// statements.push(`azure_sqldb_virtnet = '${this.virtualNetworkName}'`);
			// statements.push(`azure_sqldb_virtnetold = ${this.existingVirtualNetwork}`);
			// statements.push(`azure_sqldb_subnet = '${this.subnetName}'`);
			// statements.push(`azure_sqldb_publicip = '${this.publicIpName}'`);
			// statements.push(`azure_sqlvm_existingPublicIp = ${this.existingPublicIp}`);
			// statements.push(`azure_sqldb_allow_rdp = ${this.allowRDP}`);
			// statements.push(`azure_sqldb_sqlConnectivityType = '${this.sqlConnectivityType}'`);
			// statements.push(`azure_sqldb_port = '${this.port}'`);
			statements.push(`azure_sqldb_enableSqlAuthentication = ${this.enableSqlAuthentication}`);
			statements.push(`azure_sqldb_sqlAuthenticationUsername = '${this.sqlAuthenticationUsername}'`);
			// statements.push(`azure_sqldb_sqlOptimization = '${this.sqlOptimizationDropdown}'`);
			statements.push(`if "AZDATA_NB_VAR_azure_sqldb_PASSWORD" in os.environ:
			azure_sqldb_password = os.environ["AZDATA_NB_VAR_azure_sqldb_PASSWORD"]`);
			statements.push(`if "AZDATA_NB_VAR_azure_sqldb_SQL_PASSWORD" in os.environ:
			azure_sqldb_sqlAuthenticationPassword = os.environ["AZDATA_NB_VAR_azure_sqldb_SQL_PASSWORD"]`);

		}
		catch (error) {

		}
		return statements.map(line => line + EOL);
	}
}
