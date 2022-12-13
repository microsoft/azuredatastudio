/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

/**
 * The error codes returned to indicate what kind of error is being thrown.
 */
export enum errorCodes {
	noErrorOrUnsupported = 0,
	passwordReset = 1,
}

