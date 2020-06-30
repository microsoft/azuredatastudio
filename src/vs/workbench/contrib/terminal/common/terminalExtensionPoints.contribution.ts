/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITerminalContributionService, TerminalContributionService } from './terminalExtensionPoints';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

registerSingleton(ITerminalContributionService, TerminalContributionService, true);
