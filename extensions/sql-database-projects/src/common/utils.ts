/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


export function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}
