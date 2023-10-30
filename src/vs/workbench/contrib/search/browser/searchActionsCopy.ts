/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as nls from 'vs/nls';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { IViewsService } from 'vs/workbench/common/views';
import * as Constants from 'vs/workbench/contrib/search/common/constants';
import { FileMatch, FolderMatch, FolderMatchWithResource, Match, RenderableMatch, searchMatchComparer } from 'vs/workbench/contrib/search/browser/searchModel';
import { Action2, MenuId, registerAction2 } from 'vs/platform/actions/common/actions';
import { KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { category, getSearchView } from 'vs/workbench/contrib/search/browser/searchActionsBase';
import { isWindows } from 'vs/base/common/platform';

//#region Actions
registerAction2(class CopyMatchCommandAction extends Action2 {

	constructor(
	) {
		super({
			id: Constants.CopyMatchCommandId,
			title: {
				value: nls.localize('copyMatchLabel', "Copy"),
				original: 'Copy'
			},
			category,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: Constants.FileMatchOrMatchFocusKey,
				primary: KeyMod.CtrlCmd | KeyCode.KeyC,
			},
			menu: [{
				id: MenuId.SearchContext,
				when: Constants.FileMatchOrMatchFocusKey,
				group: 'search_2',
				order: 1
			}]
		});

	}

	override async run(accessor: ServicesAccessor, match: RenderableMatch | undefined): Promise<any> {
		await copyMatchCommand(accessor, match);
	}
});

registerAction2(class CopyPathCommandAction extends Action2 {

	constructor(
	) {
		super({
			id: Constants.CopyPathCommandId,
			title: {
				value: nls.localize('copyPathLabel', "Copy Path"),
				original: 'Copy Path'
			},
			category,
			keybinding: {
				weight: KeybindingWeight.WorkbenchContrib,
				when: Constants.FileMatchOrFolderMatchWithResourceFocusKey,
				primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC,
				win: {
					primary: KeyMod.Shift | KeyMod.Alt | KeyCode.KeyC
				},
			},
			menu: [{
				id: MenuId.SearchContext,
				when: Constants.FileMatchOrFolderMatchWithResourceFocusKey,
				group: 'search_2',
				order: 2
			}]
		});

	}

	override async run(accessor: ServicesAccessor, fileMatch: FileMatch | FolderMatchWithResource | undefined): Promise<any> {
		await copyPathCommand(accessor, fileMatch);
	}
});

registerAction2(class CopyAllCommandAction extends Action2 {

	constructor(
	) {
		super({
			id: Constants.CopyAllCommandId,
			title: {
				value: nls.localize('copyAllLabel', "Copy All"),
				original: 'Copy All'
			},
			category,
			menu: [{
				id: MenuId.SearchContext,
				when: Constants.HasSearchResults,
				group: 'search_2',
				order: 3
			}]
		});

	}

	override async run(accessor: ServicesAccessor): Promise<any> {
		await copyAllCommand(accessor);
	}
});

//#endregion

//#region Helpers
export const lineDelimiter = isWindows ? '\r\n' : '\n';

async function copyPathCommand(accessor: ServicesAccessor, fileMatch: FileMatch | FolderMatchWithResource | undefined) {
	if (!fileMatch) {
		const selection = getSelectedRow(accessor);
		if (!(selection instanceof FileMatch || selection instanceof FolderMatchWithResource)) {
			return;
		}

		fileMatch = selection;
	}

	const clipboardService = accessor.get(IClipboardService);
	const labelService = accessor.get(ILabelService);

	const text = labelService.getUriLabel(fileMatch.resource, { noPrefix: true });
	await clipboardService.writeText(text);
}

async function copyMatchCommand(accessor: ServicesAccessor, match: RenderableMatch | undefined) {
	if (!match) {
		const selection = getSelectedRow(accessor);
		if (!selection) {
			return;
		}

		match = selection;
	}

	const clipboardService = accessor.get(IClipboardService);
	const labelService = accessor.get(ILabelService);

	let text: string | undefined;
	if (match instanceof Match) {
		text = matchToString(match);
	} else if (match instanceof FileMatch) {
		text = fileMatchToString(match, labelService).text;
	} else if (match instanceof FolderMatch) {
		text = folderMatchToString(match, labelService).text;
	}

	if (text) {
		await clipboardService.writeText(text);
	}
}

async function copyAllCommand(accessor: ServicesAccessor) {
	const viewsService = accessor.get(IViewsService);
	const clipboardService = accessor.get(IClipboardService);
	const labelService = accessor.get(ILabelService);

	const searchView = getSearchView(viewsService);
	if (searchView) {
		const root = searchView.searchResult;

		const text = allFolderMatchesToString(root.folderMatches(), labelService);
		await clipboardService.writeText(text);
	}
}

function matchToString(match: Match, indent = 0): string {
	const getFirstLinePrefix = () => `${match.range().startLineNumber},${match.range().startColumn}`;
	const getOtherLinePrefix = (i: number) => match.range().startLineNumber + i + '';

	const fullMatchLines = match.fullPreviewLines();
	const largestPrefixSize = fullMatchLines.reduce((largest, _, i) => {
		const thisSize = i === 0 ?
			getFirstLinePrefix().length :
			getOtherLinePrefix(i).length;

		return Math.max(thisSize, largest);
	}, 0);

	const formattedLines = fullMatchLines
		.map((line, i) => {
			const prefix = i === 0 ?
				getFirstLinePrefix() :
				getOtherLinePrefix(i);

			const paddingStr = ' '.repeat(largestPrefixSize - prefix.length);
			const indentStr = ' '.repeat(indent);
			return `${indentStr}${prefix}: ${paddingStr}${line}`;
		});

	return formattedLines.join('\n');
}

function fileFolderMatchToString(match: FileMatch | FolderMatch | FolderMatchWithResource, labelService: ILabelService): { text: string; count: number } {
	if (match instanceof FileMatch) {
		return fileMatchToString(match, labelService);
	} else {
		return folderMatchToString(match, labelService);
	}
}

function fileMatchToString(fileMatch: FileMatch, labelService: ILabelService): { text: string; count: number } {
	const matchTextRows = fileMatch.matches()
		.sort(searchMatchComparer)
		.map(match => matchToString(match, 2));
	const uriString = labelService.getUriLabel(fileMatch.resource, { noPrefix: true });
	return {
		text: `${uriString}${lineDelimiter}${matchTextRows.join(lineDelimiter)}`,
		count: matchTextRows.length
	};
}

function folderMatchToString(folderMatch: FolderMatchWithResource | FolderMatch, labelService: ILabelService): { text: string; count: number } {
	const results: string[] = [];
	let numMatches = 0;

	const matches = folderMatch.matches().sort(searchMatchComparer);

	matches.forEach(match => {
		const result = fileFolderMatchToString(match, labelService);
		numMatches += result.count;
		results.push(result.text);
	});

	return {
		text: results.join(lineDelimiter + lineDelimiter),
		count: numMatches
	};
}

function allFolderMatchesToString(folderMatches: Array<FolderMatchWithResource | FolderMatch>, labelService: ILabelService): string {
	const folderResults: string[] = [];
	folderMatches = folderMatches.sort(searchMatchComparer);
	for (let i = 0; i < folderMatches.length; i++) {
		const folderResult = folderMatchToString(folderMatches[i], labelService);
		if (folderResult.count) {
			folderResults.push(folderResult.text);
		}
	}

	return folderResults.join(lineDelimiter + lineDelimiter);
}

function getSelectedRow(accessor: ServicesAccessor): RenderableMatch | undefined | null {
	const viewsService = accessor.get(IViewsService);
	const searchView = getSearchView(viewsService);
	return searchView?.getControl().getSelection()[0];
}

//#endregion
