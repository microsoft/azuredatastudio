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
	public azureServerName!: string;

	public databaseName!: string;
	public startIpAddress!: string;
	public endIpAddress!: string;
	public firewallRuleName!: string;

	constructor() {
		super();
	}



	public getCodeCellContentForNotebook(): string[] {
		const statements: string[] = [];

		try {
			statements.push(`azure_sqldb_nb_var_subscription = '${this.azureSubscription}'`);
			statements.push(`azure_sqldb_nb_var_resource_group_name = '${this.azureResouceGroup}'`);
			statements.push(`azure_sqldb_location = '${this.azureRegion}'`);
			statements.push(`azure_sqldb_server_name = '${this.azureServerName}'`);
		}
		catch (error) {

		}
		return statements.map(line => line + EOL);
	}
}
