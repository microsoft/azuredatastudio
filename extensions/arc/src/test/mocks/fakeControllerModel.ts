/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerInfo } from 'arc';
import { v4 as uuid } from 'uuid';
import { ControllerModel } from '../../models/controllerModel';
import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';

export class FakeControllerModel extends ControllerModel {

	constructor(treeDataProvider?: AzureArcTreeDataProvider, info?: Partial<ControllerInfo>) {
		const _info: ControllerInfo = Object.assign({ id: uuid(), endpoint: '', kubeConfigFilePath: '', kubeClusterContext: '', name: '', namespace: '', username: '', rememberPassword: false, resources: [] }, info);
		super(treeDataProvider!, _info);
	}

}
