/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { ICommandAction, MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { IProductService } from 'vs/platform/product/common/productService';
import { Registry } from 'vs/platform/registry/common/platform';
import { CATEGORIES } from 'vs/workbench/common/actions';
import { Extensions as WorkbenchExtensions, IWorkbenchContribution, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { IWebIssueService, WebIssueService } from 'vs/workbench/contrib/issue/browser/issueService';
import { OpenIssueReporterArgs, OpenIssueReporterActionId, OpenIssueReporterApiCommandId } from 'vs/workbench/contrib/issue/common/commands';

class RegisterIssueContribution implements IWorkbenchContribution {

	constructor(@IProductService readonly productService: IProductService) {
		if (productService.reportIssueUrl) {
			const OpenIssueReporterActionLabel = nls.localize({ key: 'reportIssueInEnglish', comment: ['Translate this to "Report Issue in English" in all languages please!'] }, "Report Issue");

			CommandsRegistry.registerCommand(OpenIssueReporterActionId, function (accessor, args?: [string] | OpenIssueReporterArgs) {
				let extensionId: string | undefined;
				if (args) {
					if (Array.isArray(args)) {
						[extensionId] = args;
					} else {
						extensionId = args.extensionId;
					}
				}

				return accessor.get(IWebIssueService).openReporter({ extensionId });
			});

			CommandsRegistry.registerCommand({
				id: OpenIssueReporterApiCommandId,
				handler: function (accessor, args?: [string] | OpenIssueReporterArgs) {
					let extensionId: string | undefined;
					if (args) {
						if (Array.isArray(args)) {
							[extensionId] = args;
						} else {
							extensionId = args.extensionId;
						}
					}

					if (!!extensionId && typeof extensionId !== 'string') {
						throw new Error(`Invalid argument when running '${OpenIssueReporterApiCommandId}: 'extensionId' must be of type string `);
					}

					return accessor.get(IWebIssueService).openReporter({ extensionId });
				},
				description: {
					description: 'Open the issue reporter and optionally prefill part of the form.',
					args: [
						{
							name: 'options',
							description: 'Data to use to prefill the issue reporter with.',
							isOptional: true,
							schema: {
								oneOf: [
									{
										type: 'string',
										description: 'The extension id to preselect.'
									},
									{
										type: 'object',
										properties: {
											extensionId: {
												type: 'string'
											},
										}

									}
								]
							}
						},
					]
				}
			});

			const command: ICommandAction = {
				id: OpenIssueReporterActionId,
				title: { value: OpenIssueReporterActionLabel, original: 'Report Issue' },
				category: CATEGORIES.Help
			};

			MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command });
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(RegisterIssueContribution, LifecyclePhase.Starting);

CommandsRegistry.registerCommand('_issues.getSystemStatus', (accessor) => {
	return nls.localize('statusUnsupported', "The --status argument is not yet supported in browsers.");
});

registerSingleton(IWebIssueService, WebIssueService, true);
