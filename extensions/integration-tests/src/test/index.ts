/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getDefaultMochaOptions } from '@microsoft/azdata-test';
import * as testRunner from '@microsoft/vscodetestcover';

const options = getDefaultMochaOptions('Extension Integration Tests', 'tdd');
testRunner.configure(options, { coverConfig: '../../coverConfig.json' });

export = testRunner;
