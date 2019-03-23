/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { GettingStarted } from './gettingStarted';
import { TelemetryOptOut } from './telemetryOptOut';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
// {{SQL CARBON EDIT}} - Add preview feature switch
import { EnablePreviewFeatures } from 'sql/workbench/electron-browser/enablePreviewFeatures';

// {{SQL CARBON EDIT}}
// Registry
// 	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
// 	.registerWorkbenchContribution(GettingStarted, LifecyclePhase.Running);

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(GettingStarted, LifecyclePhase.Restored);

Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(TelemetryOptOut, LifecyclePhase.Eventually);

// {{SQL CARBON EDIT}} - Add preview feature switch
Registry
	.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(EnablePreviewFeatures, LifecyclePhase.Eventually);
