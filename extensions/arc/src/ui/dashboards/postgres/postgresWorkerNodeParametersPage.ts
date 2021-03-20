/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
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

	protected async saveParameterEdits(engineSettings: string, session: azdataExt.AzdataSession): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: engineSettings },
			this._postgresModel.engineVersion,
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			session);

	}

	protected async resetAllParameters(session: azdataExt.AzdataSession): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: `''`, replaceEngineSettings: true },
			this._postgresModel.engineVersion,
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			session);

	}

	protected async resetParameter(parameterName: string, session: azdataExt.AzdataSession): Promise<void> {
		await this._azdataApi.azdata.arc.postgres.server.edit(
			this._postgresModel.info.name,
			{ engineSettings: parameterName + '=' },
			this._postgresModel.engineVersion,
			this._postgresModel.controllerModel.azdataAdditionalEnvVars,
			session);

	}

	protected refreshParametersTable(): void {
		this._parameters = this._postgresModel.workerNodesEngineSettings.map(engineSetting => this.createParameterComponents(engineSetting));
		this._parametersTable.data = this._parameters.map(p => [p.parameterName, p.valueContainer, p.description, p.resetButton]);
	}
}
