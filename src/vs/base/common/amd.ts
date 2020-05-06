/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';

export function getPathFromAmdModule(requirefn: typeof require, relativePath: string): string {
	return getUriFromAmdModule(requirefn, relativePath).fsPath;
}

export function getUriFromAmdModule(requirefn: typeof require, relativePath: string): URI {
	return URI.parse(requirefn.toUrl(relativePath));
}
