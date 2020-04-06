/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { azureResource } from '../../typings/azure-resource';
import { ApiWrapper } from '../../common/apiWrapper';
import { ViewBase } from '../viewBase';
import { RegisteredModel, WorkspaceModel, RegisteredModelDetails, ModelParameters } from '../../modelManagement/interfaces';
import { PredictParameters, DatabaseTable, TableColumn } from '../../prediction/interfaces';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { AzureWorkspaceResource, AzureModelResource } from '../interfaces';


export interface AzureResourceEventArgs extends AzureWorkspaceResource {
}

export interface RegisterModelEventArgs extends AzureWorkspaceResource {
	details?: RegisteredModelDetails
}

export interface PredictModelEventArgs extends PredictParameters {
	model?: RegisteredModel;
	filePath?: string;
}


export enum ModelSourceType {
	Local,
	Azure,
	RegisteredModels
}

export interface ModelViewData {
	modelFile?: string;
	modelData: AzureModelResource | string | RegisteredModel;
	modelDetails?: RegisteredModelDetails;
}

// Event names
//
export const ListModelsEventName = 'listModels';
export const ListAzureModelsEventName = 'listAzureModels';
export const ListAccountsEventName = 'listAccounts';
export const ListDatabaseNamesEventName = 'listDatabaseNames';
export const ListTableNamesEventName = 'listTableNames';
export const ListColumnNamesEventName = 'listColumnNames';
export const ListSubscriptionsEventName = 'listSubscriptions';
export const ListGroupsEventName = 'listGroups';
export const ListWorkspacesEventName = 'listWorkspaces';
export const RegisterLocalModelEventName = 'registerLocalModel';
export const RegisterAzureModelEventName = 'registerAzureLocalModel';
export const DownloadAzureModelEventName = 'downloadAzureLocalModel';
export const DownloadRegisteredModelEventName = 'downloadRegisteredModel';
export const PredictModelEventName = 'predictModel';
export const RegisterModelEventName = 'registerModel';
export const SourceModelSelectedEventName = 'sourceModelSelected';
export const LoadModelParametersEventName = 'loadModelParameters';

/**
 * Base class for all model management views
 */
export abstract class ModelViewBase extends ViewBase {

	private _modelSourceType: ModelSourceType = ModelSourceType.Local;
	private _modelsViewData: ModelViewData[] = [];

	constructor(apiWrapper: ApiWrapper, root?: string, parent?: ModelViewBase) {
		super(apiWrapper, root, parent);
	}

	protected getEventNames(): string[] {
		return super.getEventNames().concat([ListModelsEventName,
			ListAzureModelsEventName,
			ListAccountsEventName,
			ListSubscriptionsEventName,
			ListGroupsEventName,
			ListWorkspacesEventName,
			RegisterLocalModelEventName,
			RegisterAzureModelEventName,
			RegisterModelEventName,
			SourceModelSelectedEventName,
			ListDatabaseNamesEventName,
			ListTableNamesEventName,
			ListColumnNamesEventName,
			PredictModelEventName,
			DownloadAzureModelEventName,
			DownloadRegisteredModelEventName,
			LoadModelParametersEventName]);
	}

	/**
	 * Parent view
	 */
	public get parent(): ModelViewBase | undefined {
		return this._parent ? <ModelViewBase>this._parent : undefined;
	}

	/**
	 * list azure models
	 */
	public async listAzureModels(workspaceResource: AzureWorkspaceResource): Promise<WorkspaceModel[]> {
		const args: AzureResourceEventArgs = workspaceResource;
		return await this.sendDataRequest(ListAzureModelsEventName, args);
	}

	/**
	 * list registered models
	 */
	public async listModels(): Promise<RegisteredModel[]> {
		return await this.sendDataRequest(ListModelsEventName);
	}

	/**
	 * lists azure accounts
	 */
	public async listAzureAccounts(): Promise<azdata.Account[]> {
		return await this.sendDataRequest(ListAccountsEventName);
	}

	/**
	 * lists database names
	 */
	public async listDatabaseNames(): Promise<string[]> {
		return await this.sendDataRequest(ListDatabaseNamesEventName);
	}

	/**
	 * lists table names
	 */
	public async listTableNames(dbName: string): Promise<DatabaseTable[]> {
		return await this.sendDataRequest(ListTableNamesEventName, dbName);
	}

	/**
	 * lists column names
	 */
	public async listColumnNames(table: DatabaseTable): Promise<TableColumn[]> {
		return await this.sendDataRequest(ListColumnNamesEventName, table);
	}

	/**
	 * lists azure subscriptions
	 * @param account azure account
	 */
	public async listAzureSubscriptions(account: azdata.Account | undefined): Promise<azureResource.AzureResourceSubscription[]> {
		const args: AzureResourceEventArgs = {
			account: account
		};
		return await this.sendDataRequest(ListSubscriptionsEventName, args);
	}

	/**
	 * registers local model
	 * @param localFilePath local file path
	 */
	public async registerLocalModel(models: ModelViewData[]): Promise<void> {
		return await this.sendDataRequest(RegisterLocalModelEventName, models);
	}

	/**
	 * downloads registered model
	 * @param model model to download
	 */
	public async downloadRegisteredModel(model: RegisteredModel | undefined): Promise<string> {
		return await this.sendDataRequest(DownloadRegisteredModelEventName, model);
	}

	/**
	 * download azure model
	 * @param args azure resource
	 */
	public async downloadAzureModel(resource: AzureModelResource | undefined): Promise<string> {
		return await this.sendDataRequest(DownloadAzureModelEventName, resource);
	}

	/**
	 * Loads model parameters
	 */
	public async loadModelParameters(): Promise<ModelParameters | undefined> {
		return await this.sendDataRequest(LoadModelParametersEventName);
	}

	/**
	 * registers azure model
	 * @param args azure resource
	 */
	public async registerAzureModel(models: ModelViewData[]): Promise<void> {
		return await this.sendDataRequest(RegisterAzureModelEventName, models);
	}

	/**
	 * registers azure model
	 * @param args azure resource
	 */
	public async generatePredictScript(model: RegisteredModel | undefined, filePath: string | undefined, params: PredictParameters | undefined): Promise<void> {
		const args: PredictModelEventArgs = Object.assign({}, params, {
			model: model,
			filePath: filePath,
			loadFromRegisteredModel: !filePath
		});
		return await this.sendDataRequest(PredictModelEventName, args);
	}

	/**
	 * list resource groups
	 * @param account azure account
	 * @param subscription azure subscription
	 */
	public async listAzureGroups(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined): Promise<azureResource.AzureResource[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription
		};
		return await this.sendDataRequest(ListGroupsEventName, args);
	}


	/**
	 * Sets model source type
	 */
	public set modelSourceType(value: ModelSourceType) {
		if (this.parent) {
			this.parent.modelSourceType = value;
		} else {
			this._modelSourceType = value;
		}
	}

	/**
	 * Returns model source type
	 */
	public get modelSourceType(): ModelSourceType {
		if (this.parent) {
			return this.parent.modelSourceType;
		} else {
			return this._modelSourceType;
		}
	}

	/**
	 * Sets model source type
	 */
	public set modelsViewData(value: ModelViewData[]) {
		if (this.parent) {
			this.parent.modelsViewData = value;
		} else {
			this._modelsViewData = value;
		}
	}

	/**
	 * Returns model source type
	 */
	public get modelsViewData(): ModelViewData[] {
		if (this.parent) {
			return this.parent.modelsViewData;
		} else {
			return this._modelsViewData;
		}
	}

	/**
	 * lists azure workspaces
	 * @param account azure account
	 * @param subscription azure subscription
	 * @param group azure resource group
	 */
	public async listWorkspaces(account: azdata.Account | undefined, subscription: azureResource.AzureResourceSubscription | undefined, group: azureResource.AzureResource | undefined): Promise<Workspace[]> {
		const args: AzureResourceEventArgs = {
			account: account,
			subscription: subscription,
			group: group
		};
		return await this.sendDataRequest(ListWorkspacesEventName, args);
	}
}
