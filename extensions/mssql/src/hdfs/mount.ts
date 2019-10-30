/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Information about a HDFS mount to a remote directory
 */
export interface Mount {
	mountPath: string;
	mountStatus: string;
	remotePath: string;
}

export enum MountStatus {
	None = 0,
	Mount = 1,
	Mount_Child = 2
}
