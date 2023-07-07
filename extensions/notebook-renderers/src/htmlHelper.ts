/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const ttPolicy = (typeof window !== 'undefined') ?
	window.trustedTypes?.createPolicy('notebookRenderer', {
		createHTML: value => value,
		createScript: value => value,
	}) : undefined;
