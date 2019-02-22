/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ILocalizeInfo {
	key: string;
	comment: string[];
}

export declare function localize(info: ILocalizeInfo, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
export declare function localize(key: string, message: string, ...args: (string | number | boolean | undefined | null)[]): string;
