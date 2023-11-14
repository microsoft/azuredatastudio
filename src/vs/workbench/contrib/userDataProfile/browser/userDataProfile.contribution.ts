/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions } from 'vs/workbench/common/contributions';
import { UserDataProfilesWorkbenchContribution } from 'vs/workbench/contrib/userDataProfile/browser/userDataProfile';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import './userDataProfileActions';
import { UserDataProfilePreviewContribution } from 'vs/workbench/contrib/userDataProfile/browser/userDataProfilePreview';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(UserDataProfilesWorkbenchContribution, LifecyclePhase.Ready);
workbenchRegistry.registerWorkbenchContribution(UserDataProfilePreviewContribution, LifecyclePhase.Restored);
