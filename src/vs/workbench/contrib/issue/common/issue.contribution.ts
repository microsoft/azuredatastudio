/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { ICommandAction } from 'vs/platform/action/common/action';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { CommandsRegistry, ICommandHandlerDescription } from 'vs/platform/commands/common/commands';
import { IssueReporterData } from 'vs/platform/issue/common/issue';
import { IProductService } from 'vs/platform/product/common/productService';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IWorkbenchIssueService } from 'vs/workbench/services/issue/common/issue';

const OpenIssueReporterActionId = 'workbench.action.openIssueReporter';
const OpenIssueReporterApiId = 'vscode.openIssueReporter';

const OpenIssueReporterCommandDescription: ICommandHandlerDescription = {
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
							issueTitle: {
								type: 'string'
							},
							issueBody: {
								type: 'string'
							}
						}

					}
				]
			}
		},
	]
};

interface OpenIssueReporterArgs {
	readonly extensionId?: string;
	readonly issueTitle?: string;
	readonly issueBody?: string;
}

export class BaseIssueContribution implements IWorkbenchContribution {
	constructor(
		@IProductService productService: IProductService
	) {
		if (!productService.reportIssueUrl) {
			return;
		}

		CommandsRegistry.registerCommand({
			id: OpenIssueReporterActionId,
			handler: function (accessor, args?: string | [string] | OpenIssueReporterArgs) {
				const data: Partial<IssueReporterData> =
					typeof args === 'string'
						? { extensionId: args }
						: Array.isArray(args)
							? { extensionId: args[0] }
							: args ?? {};

				return accessor.get(IWorkbenchIssueService).openReporter(data);
			},
			description: OpenIssueReporterCommandDescription
		});

		CommandsRegistry.registerCommand({
			id: OpenIssueReporterApiId,
			handler: function (accessor, args?: string | [string] | OpenIssueReporterArgs) {
				const data: Partial<IssueReporterData> =
					typeof args === 'string'
						? { extensionId: args }
						: Array.isArray(args)
							? { extensionId: args[0] }
							: args ?? {};

				return accessor.get(IWorkbenchIssueService).openReporter(data);
			},
			description: OpenIssueReporterCommandDescription
		});

		const reportIssue: ICommandAction = {
			id: OpenIssueReporterActionId,
			title: {
				value: localize({ key: 'reportIssueInEnglish', comment: ['Translate this to "Report Issue in English" in all languages please!'] }, "Report Issue..."),
				original: 'Report Issue...'
			},
			category: Categories.Help
		};

		MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: reportIssue });

		MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
			group: '3_feedback',
			command: {
				id: OpenIssueReporterActionId,
				title: localize({ key: 'miReportIssue', comment: ['&& denotes a mnemonic', 'Translate this to "Report Issue in English" in all languages please!'] }, "Report &&Issue")
			},
			order: 3
		});
	}
}
