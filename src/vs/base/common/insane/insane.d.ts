/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export as namespace insane;

export = insane;

declare function insane(
	html: string,
	options?: {
		readonly allowedSchemes?: readonly string[],
		readonly allowedTags?: readonly string[],
		readonly allowedAttributes?: { readonly [key: string]: string[] },
	},
	strict?: boolean,
): string;

declare namespace insane { }
