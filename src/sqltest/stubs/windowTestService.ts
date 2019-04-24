/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as platform from 'vs/base/common/platform';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';
import { TestWindowService as vsTestWindowService } from 'vs/workbench/test/workbenchTestServices';

export class TestWindowService extends vsTestWindowService {

	constructor(private env: platform.IProcessEnvironment) {
		super();
	}

	getConfiguration(): IWindowConfiguration {
		return { userEnv: this.env } as IWindowConfiguration;
	}
}