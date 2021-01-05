/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ITestService } from 'vs/workbench/contrib/testing/common/testService';
import { TestService } from 'vs/workbench/contrib/testing/common/testServiceImpl';

registerSingleton(ITestService, TestService);
