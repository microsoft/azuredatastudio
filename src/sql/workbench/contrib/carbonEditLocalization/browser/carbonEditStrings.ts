/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

// Contains vs strings that are nonnative to vscode that need to be translated.
const fixedStrings = {
	'fileActions.contribution.newQuery': nls.localize('newQuery', "New Query"),
	'fileActions.contribution.miNewQuery': nls.localize({ key: 'miNewQuery', comment: ['&& denotes a mnemonic'] }, "New &&Query"),
	'fileACtions.contribution.miNewNotebook': nls.localize({ key: 'miNewNotebook', comment: ['&& denotes a mnemonic'] }, "&&New Notebook"),
	'watermark.newSqlFile': nls.localize('watermark.newSqlFile', "New SQL File"),
	'watermark.newNotebook': nls.localize('watermark.newNotebook', "New Notebook"),
	'files.contribution.maxMemoryForLargeFilesMB': nls.localize('maxMemoryForLargeFilesMB', "Controls the memory available to Azure Data Studio after restart when trying to open large files. Same effect as specifying `--max-memory=NEWSIZE` on the command line.")
};

export function getCustomString(stringName: string, ...stringParams: string[]): string {
	//handle strings with arguments
	if (stringName === 'localizations.contribution.updateLocale') {
		return nls.localize('updateLocale', "Would you like to change Azure Data Studio's UI language to {0} and restart?", ...stringParams);
	}
	else if (stringName === 'localizations.contribution.activateLanguagePack') {
		return nls.localize('activateLanguagePack', "In order to use Azure Data Studio in {0}, Azure Data Studio needs to restart.", ...stringParams);
	}
	else if (fixedStrings[stringName]) {
		return fixedStrings[stringName];
	}
	else {
		return nls.localize('stringNotFound', "String was not found.");
	}

}
