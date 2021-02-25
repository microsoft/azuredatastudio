/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as loc from '../../../localizedConstants';
import { IconPathHelper } from '../../../constants';
import { PostgresServerParametersPage } from './postgresServerParameters';
import { PostgresModel } from '../../../models/postgresModel';

export class PostgresWorkerNodesParametersPage extends PostgresServerParametersPage {
	private readonly _azdataApi: azdataExt.IExtension;

	constructor(protected modelView: azdata.ModelView, _postgresModel: PostgresModel) {
		super(_postgresModel, modelView);
		this._azdataApi = vscode.extensions.getExtension(azdataExt.extension.name)?.exports;

		this.initializeConnectButton();
		this.initializeSearchBox();

		this.disposables.push(
			this._postgresModel.onConfigUpdated(() => this.eventuallyRunOnInitialized(() => this.handleServiceUpdated())),
			this._postgresModel.onEngineSettingsUpdated(() => this.eventuallyRunOnInitialized(() => this.refreshParametersTable()))
		);
	}

	protected get title(): string {
		return loc.workerNodesParameters;
	}

	protected get id(): string {
		return 'postgres-worker-nodes-parameters';
	}

	protected get icon(): { dark: string; light: string; } {
		return IconPathHelper.gear;
	}

	protected get description(): string {
		return loc.workerNodesParametersDescription;
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
		this._parameters = this._postgresModel._workerNodesEngineSettings.map(engineSetting => this.createParameterComponents(engineSetting));
		this.parametersTable.data = this._parameters.map(p => [p.parameterName, p.valueContainer, p.description, p.resetButton]);
	}
}
