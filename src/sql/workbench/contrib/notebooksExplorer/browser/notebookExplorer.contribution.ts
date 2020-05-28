/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/notebookExplorer.contribution';
import { localize } from 'vs/nls';
import { ViewletRegistry, Extensions as ViewletExtensions } from 'vs/workbench/browser/viewlet';
import { Registry } from 'vs/platform/registry/common/platform';
import { NotebookExplorerViewletViewsContribution, OpenNotebookExplorerViewletAction, VIEWLET_ID } from 'sql/workbench/contrib/notebooksExplorer/browser/notebookExplorerViewlet';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';

Registry.as<ViewletRegistry>(ViewletExtensions.Viewlets).setDefaultViewletId(VIEWLET_ID);
const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(NotebookExplorerViewletViewsContribution, LifecyclePhase.Starting);
const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
registry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		OpenNotebookExplorerViewletAction,
		OpenNotebookExplorerViewletAction.ID,
		OpenNotebookExplorerViewletAction.LABEL,
		{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_B }),
	'View: Show Notebook Explorer',
	localize('notebookExplorer.view', "View")
);
