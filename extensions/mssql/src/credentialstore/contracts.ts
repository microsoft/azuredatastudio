/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestType } from 'vscode-languageclient';
import { Credential } from 'azdata';

// --------------------------------- < Read Credential Request > -------------------------------------------------

// We don't need to include the actual password field when making read/delete requests, so for now just
// creating a custom type here to avoid issues with strict null checking until we can get STS updated
// to expect just the ID itself instead of the full credential object type
export type CredentialId = Omit<Credential, 'password'>;

// Read Credential request message callback declaration
export namespace ReadCredentialRequest {
	export const type = new RequestType<CredentialId, Credential, void, void>('credential/read');
}

// --------------------------------- </ Read Credential Request > -------------------------------------------------

// --------------------------------- < Save Credential Request > -------------------------------------------------

// Save Credential request message callback declaration
export namespace SaveCredentialRequest {
	export const type = new RequestType<Credential, boolean, void, void>('credential/save');
}
// --------------------------------- </ Save Credential Request > -------------------------------------------------


// --------------------------------- < Delete Credential Request > -------------------------------------------------

// Delete Credential request message callback declaration
export namespace DeleteCredentialRequest {
	export const type = new RequestType<CredentialId, boolean, void, void>('credential/delete');
}
// --------------------------------- </ Delete Credential Request > -------------------------------------------------
