/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IOutputChannelModelService, AsbtractOutputChannelModelService } from 'vs/workbench/services/output/common/outputChannelModel';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

export class OutputChannelModelService extends AsbtractOutputChannelModelService implements IOutputChannelModelService {
	_serviceBrand: undefined;
}

registerSingleton(IOutputChannelModelService, OutputChannelModelService);
