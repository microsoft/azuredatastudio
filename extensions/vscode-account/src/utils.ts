/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function toBase64UrlEncoding(base64string: string) {
	return base64string.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); // Need to use base64url encoding
}
