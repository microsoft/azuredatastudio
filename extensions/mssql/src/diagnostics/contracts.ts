/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { RequestType } from 'vscode-languageclient';
import { diagnostics } from 'azdata';

export interface DiagnosticsParameters {
	/**
	 * The code of the error we want to check.
	 */
	errorCode: number;
	/**
	 * The accompanying error message.
	 */
	errorMessage: string;
	/**
	 * The name of the provider where the error happened.
	 */
	providerName: string;
}

export namespace DiagnosticsRequest {
	export const type = new RequestType<DiagnosticsParameters, diagnostics.ErrorCodes, void, void>('diagnostics/codeCheck');
}
