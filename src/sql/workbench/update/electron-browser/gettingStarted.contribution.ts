/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { ShowGettingStartedAction } from 'sql/workbench/update/electron-browser/gettingStarted';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';

// add getting started contributions
Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions)
	.registerWorkbenchAction(SyncActionDescriptor.create(ShowGettingStartedAction, ShowGettingStartedAction.ID, ShowGettingStartedAction.LABEL), 'Show Getting Started');
