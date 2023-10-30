/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IQuickAccessRegistry, Extensions } from 'vs/platform/quickinput/common/quickAccess';
import { QuickHelpNLS } from 'vs/editor/common/standaloneStrings';
import { HelpQuickAccessProvider } from 'vs/platform/quickinput/browser/helpQuickAccess';

Registry.as<IQuickAccessRegistry>(Extensions.Quickaccess).registerQuickAccessProvider({
	ctor: HelpQuickAccessProvider,
	prefix: '',
	helpEntries: [{ description: QuickHelpNLS.helpQuickAccessActionLabel }]
});
