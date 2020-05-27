/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ControllerModel } from '../../../models/controllerModel';
import { PostgresModel } from '../../../models/postgresModel';
import { DashboardPage } from '../../components/dashboardPage';

export abstract class PostgresDashboardPage extends DashboardPage {
	constructor(protected modelView: azdata.ModelView, protected controllerModel: ControllerModel, protected databaseModel: PostgresModel) {
		super(modelView);
	}
}
