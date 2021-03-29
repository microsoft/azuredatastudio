/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresParametersPage } from './postgresParameters';
import { PostgresModel, EngineSettingsModel } from '../../../models/postgresModel';

export class PostgresCoordinatorNodeParametersPage extends PostgresParametersPage {

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, postgresModel: PostgresModel) {
		super(modelView, dashboard, postgresModel);
	}

	protected get title(): string {
		return loc.coordinatorNodeParameters;
	}

	protected get id(): string {
		return 'postgres-coordinator-node-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.gearGray;
	}

	protected get description(): string {
		return loc.coordinatorNodeParametersDescription;
	}

	protected get engineSettings(): EngineSettingsModel[] {
		return this._postgresModel.coordinatorNodeEngineSettings;
	}

	protected async saveParameterEdits(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			await this._azdataApi.azdata.arc.postgres.server.edit(
				this._postgresModel.info.name,
				{ engineSettings: engineSettings },
				this._postgresModel.engineVersion,
				this._postgresModel.controllerModel.azdataAdditionalEnvVars,
				session);
		*/
	}

	protected async resetAllParameters(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			await this._azdataApi.azdata.arc.postgres.server.edit(
				this._postgresModel.info.name,
				{ engineSettings: `''`, replaceEngineSettings: true },
				this._postgresModel.engineVersion,
				this._postgresModel.controllerModel.azdataAdditionalEnvVars,
				session);
		*/
	}

	protected async resetParameter(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			await this._azdataApi.azdata.arc.postgres.server.edit(
				this._postgresModel.info.name,
				{ engineSettings: parameterName + '=' },
				this._postgresModel.engineVersion,
				this._postgresModel.controllerModel.azdataAdditionalEnvVars,
				session);
		*/
	}
}
