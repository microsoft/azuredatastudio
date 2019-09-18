/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IIssueService } from 'vs/platform/issue/node/issue';
import { IMainProcessService, createSimpleMainChannelProxy } from 'vs/platform/ipc/electron-browser/mainProcessService';

export class IssueService {

	_serviceBrand: undefined;

	constructor(@IMainProcessService mainProcessService: IMainProcessService) {
		return createSimpleMainChannelProxy<IIssueService>('issue', mainProcessService);
	}
}
