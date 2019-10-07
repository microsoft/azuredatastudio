/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { NativeTelemetryOptOut } from 'vs/workbench/contrib/welcome/gettingStarted/electron-browser/telemetryOptOut';
import { OpenWelcomePageInBrowser } from 'vs/workbench/contrib/welcome/gettingStarted/electron-browser/openWebsite';

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(OpenWelcomePageInBrowser, LifecyclePhase.Restored);
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NativeTelemetryOptOut, LifecyclePhase.Eventually);
