/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface ArrayConstructor {
	isArray(arg: any): arg is Array<any>;
	isArray<T>(arg: any): arg is Array<T>;
}