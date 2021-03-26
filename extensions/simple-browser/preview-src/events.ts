/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function onceDocumentLoaded(f: () => void) {
	if (document.readyState === 'loading' || document.readyState as string === 'uninitialized') {
		document.addEventListener('DOMContentLoaded', f);
	} else {
		f();
	}
}