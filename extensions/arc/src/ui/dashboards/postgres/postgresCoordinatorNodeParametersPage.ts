/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresParametersPage } from './postgresParameters';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresCoordinatorNodeParametersPage extends PostgresParametersPage {

	constructor(protected modelView: azdata.ModelView, _postgresModel: PostgresModel) {
		super(modelView, _postgresModel);
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

	protected async saveParameterEdits(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			try {
				await this._azdataApi.azdata.arc.postgres.server.edit(
					this._postgresModel.info.name,
					{ engineSettings: engineSettings },
					this._postgresModel.engineVersion,
					this._postgresModel.controllerModel.azdataAdditionalEnvVars,
					session);
			} catch (error) {
				throw error;
			}
		*/
	}

	protected async resetAllParameters(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			try {
				await this._azdataApi.azdata.arc.postgres.server.edit(
					this._postgresModel.info.name,
					{ engineSettings: `''`, replaceEngineSettings: true },
					this._postgresModel.engineVersion,
					this._postgresModel.controllerModel.azdataAdditionalEnvVars,
					session);
			} catch (error) {
				throw error;
			}
		*/
	}

	protected async resetParameter(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			try {
				await this._azdataApi.azdata.arc.postgres.server.edit(
					this._postgresModel.info.name,
					{ engineSettings: parameterName + '=' },
					this._postgresModel.engineVersion,
					this._postgresModel.controllerModel.azdataAdditionalEnvVars,
					session);
			} catch (error) {
				throw error;
			}
		*/
	}

	protected refreshParametersTable(): void {
		this._parameters = this._postgresModel.coordinatorNodeEngineSettings.map(engineSetting => this.createParameterComponents(engineSetting));
		this._parametersTable.data = this._parameters.map(p => [p.parameterName, p.valueContainer, p.description, p.resetButton]);
	}
}
