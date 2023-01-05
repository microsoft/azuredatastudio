/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RequestType } from 'vscode-languageclient';
import { diagnostics } from 'azdata';

export interface ErrorHandlerParameters {
	/**
	 * The error code returned from the connection result in case an error happened.
	 */
	errorCode: number;
	/**
	 * The accompanying error message.
	 */
	errorMessage: string;
	/**
	 * The name of the provider that was trying to connect.
	 */
	providerName: string;
	/**
	 * OwnerUri of the connection that tried to connect.
	 */
	ownerUri: string;
}

export namespace ErrorHandlerRequest {
	export const type = new RequestType<ErrorHandlerParameters, diagnostics.ErrorCodes, void, void>('errorHandle/errorHandler');
}
