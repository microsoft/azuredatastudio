/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ITroubleshooterMessageService } from 'sql/platform/troubleshooter/common/troubleshooterMessageService';

export class TestTroubleshooterMessageService implements ITroubleshooterMessageService {
	_serviceBrand: undefined;
	showDialog(headerTitle: string, message: azdata.window.ITroubleshooterItem): void {
	}
}
