/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresParametersPage } from './postgresParameters';
import { PostgresModel, EngineSettingsModel } from '../../../models/postgresModel';

export class PostgresWorkerNodeParametersPage extends PostgresParametersPage {

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, postgresModel: PostgresModel) {
		super(modelView, dashboard, postgresModel);
	}

	protected get title(): string {
		return loc.workerNodeParameters;
	}

	protected get id(): string {
		return 'postgres-worker-node-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.gearBlue;
	}

	protected get description(): string {
		return loc.workerNodesParametersDescription;
	}


	protected get engineSettings(): EngineSettingsModel[] {
		return this._postgresModel.workerNodesEngineSettings;
	}

}
