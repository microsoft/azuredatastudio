/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresParametersPage } from './postgresParameters';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresWorkerNodeParametersPage extends PostgresParametersPage {

	constructor(modelView: azdata.ModelView, dashboard: azdata.window.ModelViewDashboard, postgresModel: PostgresModel) {
		super(modelView, dashboard, postgresModel);
	}

	protected get title(): string {
		// TODO update to loc.workerNodeParameters
		return loc.nodeParameters;
	}

	protected get id(): string {
		// TODO update to 'postgres-worker-node-parameters'
		return 'postgres-nodes-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.gearBlue;
	}

	protected get description(): string {
		// TODO update to loc.workerNodesParametersDescription
		return loc.nodeParametersDescription;
	}

	protected async saveParameterEdits(engineSettings: string): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: engineSettings },
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			this._postgresModel.controllerModel.controllerContext);
	}

	protected async resetAllParameters(): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: `''`, replaceEngineSettings: true },
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			this._postgresModel.controllerModel.controllerContext);
	}

	protected async resetParameter(parameterName: string): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: parameterName + '=' },
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			this._postgresModel.controllerModel.controllerContext);
	}

	protected refreshParametersTable(): void {
		this._parameters = this._postgresModel.workerNodesEngineSettings.map(engineSetting => this.createParameterComponents(engineSetting));
		this._parametersTable.data = this._parameters.map(p => [p.parameterName, p.valueContainer, p.description, p.resetButton]);
	}
}
