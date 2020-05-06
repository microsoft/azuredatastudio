/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { azureResource } from '../typings/azure-resource';
import { Workspace } from '@azure/arm-machinelearningservices/esm/models';
import { WorkspaceModel } from '../modelManagement/interfaces';

export interface IDataComponent<T> {
	data: T | undefined;
}

export interface IPageView {
	registerComponent: (modelBuilder: azdata.ModelBuilder) => azdata.Component;
	component: azdata.Component | undefined;
	onEnter?: () => Promise<void>;
	onLeave?: () => Promise<void>;
	validate?: () => Promise<boolean>;
	refresh: () => Promise<void>;
	disposePage?: () => Promise<void>;
	viewPanel: azdata.window.ModelViewPanel | undefined;
	title: string;
}

export interface AzureWorkspaceResource {
	account?: azdata.Account,
	subscription?: azureResource.AzureResourceSubscription,
	group?: azureResource.AzureResource,
	workspace?: Workspace
}

export interface AzureModelResource extends AzureWorkspaceResource {
	model?: WorkspaceModel;
}

export interface IComponentSettings {
	multiSelect?: boolean;
	editable?: boolean;
	selectable?: boolean;
}


