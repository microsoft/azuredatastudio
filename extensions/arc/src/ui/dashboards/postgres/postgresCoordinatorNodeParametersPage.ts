/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresServerParametersPage } from './postgresServerParameters';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresCoordinatorNodeParametersPage extends PostgresServerParametersPage {
	// TODO add back in once making command calls
	// private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, _postgresModel: PostgresModel) {
		super(_postgresModel, modelView);
		// this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConnectButton();
		this.initializeSearchBox();

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())),
			this._postgresModel.onEngineSettingsUpdated(() => this.eventuallyRunOnInitialized(() => this.refreshParametersTable()))
		);
	}

	protected get title(): string {
		return loc.coordinatorNodeParameters;
	}

	protected get id(): string {
		return 'postgres-coordinator-node-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.gearBlack;
	}

	protected get description(): string {
		return loc.coordinatorNodeParametersDescription;
	}

	protected async saveParameterEdits(): Promise<void> {
		/* TODO add correct azdata call for editing coordinator parameters
			await this._azdataApi.azdata.arc.postgres.server.edit(
				this._postgresModel.info.name,
				{ engineSettings: engineSettings.toString() },
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

	protected refreshParametersTable(): void {
		this._parameters = this._postgresModel._coordinatorNodeEngineSettings.map(engineSetting => this.createParameterComponents(engineSetting));
		this.parametersTable.data = this._parameters.map(p => [p.parameterName, p.valueContainer, p.description, p.resetButton]);
	}
}
