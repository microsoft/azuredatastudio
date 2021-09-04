/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWindows } from 'vs/base/common/platform';

/**
 * Due to marked js parsing returning an invalid path (ex. ....\) we must format the path to ensure directories are formatted properly (ex. ..\..\).
 * Issue tracked here: https://github.com/markedjs/marked/issues/2135
 * The function only formats the path for Windows platform (in which the invalid form occurs) and checks to see if the path is invalid based on the leading periods.
 * We use the first slash of path and create a relative path format (..\) string based on amount of leading periods
 * and then concatenate the relative path format string to rest of path after slash
 * @param href is the relative path
 * @returns properly formatted relative path
 */
export function replaceInvalidLinkPath(href: string): string {
	if (isWindows && href.startsWith('...')) {
		let slashIndex = href.indexOf('\\');
		href = '..\\'.repeat(slashIndex / 2) + href.substring(slashIndex + 1);
		return href;
	} else {
		// returns original path since it is valid
		return href;
	}
}
