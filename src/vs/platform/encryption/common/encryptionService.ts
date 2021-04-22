/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ICommonEncryptionService {

	readonly _serviceBrand: undefined;

	encrypt(value: string): Promise<string>;

	decrypt(value: string): Promise<string>;
}
