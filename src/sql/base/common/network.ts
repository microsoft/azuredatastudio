/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
* Checks if the specified URL is already URI-encoded by checking if there are any unencoded reserved URI component characters
* (such as ?, =, &, /, etc.) in the URL. See https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent for more details.
* @returns true if the URL contains encoded URI component reserved characters
*/
export function containsEncodedUriComponentReservedCharacters(url: string): boolean {
	// ie ?,=,&,/ etc
	return (decodeURI(url) !== decodeURIComponent(url));
}
