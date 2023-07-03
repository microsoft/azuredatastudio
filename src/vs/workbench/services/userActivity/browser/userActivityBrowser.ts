/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DomActivityTracker } from 'vs/workbench/services/userActivity/browser/domActivityTracker';
import { userActivityRegistry } from 'vs/workbench/services/userActivity/common/userActivityRegistry';

userActivityRegistry.add(DomActivityTracker);
