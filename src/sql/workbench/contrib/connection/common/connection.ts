/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// ------------------------------- < Cancel Connect Request > ---------------------------------------

/**
 * Cancel connect request message format
 */
export class CancelConnectParams {
	/**
	 * URI identifying the owner of the connection
	 */
	public ownerUri: string;
}

// ------------------------------- </ Cancel Connect Request > --------------------------------------

// ------------------------------- < Disconnect Request > -------------------------------------------

// Disconnect request message format
export class DisconnectParams {
	// URI identifying the owner of the connection
	public ownerUri: string;
}

// ------------------------------- </ Disconnect Request > ------------------------------------------
