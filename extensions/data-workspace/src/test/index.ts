/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getDefaultMochaOptions } from '@microsoft/azdata-test';
import * as testRunner from '@microsoft/vscodetestcover';

const options = getDefaultMochaOptions('Data Workspace Extension Tests', 'tdd');

testRunner.configure(options, { coverConfig: '../../coverConfig.json' });

export = testRunner;
