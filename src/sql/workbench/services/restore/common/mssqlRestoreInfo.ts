/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

export class MssqlRestoreInfo implements azdata.RestoreInfo {

	options: { [name: string]: any };

	public constructor(public taskExecutionMode: azdata.TaskExecutionMode) {
		this.options = {};
	}

	public get sessionId(): string {
		return this.options['sessionId'];
	}

	public set sessionId(value: string) {
		this.options['sessionId'] = value;
	}

	public get backupFilePaths(): string {
		return this.options['backupFilePaths'];
	}

	public set backupFilePaths(value: string) {
		this.options['backupFilePaths'] = value;
	}

	public get targetDatabaseName(): string {
		return this.options['targetDatabaseName'];
	}

	public set targetDatabaseName(value: string) {
		this.options['targetDatabaseName'] = value;
	}

	public get sourceDatabaseName(): string {
		return this.options['sourceDatabaseName'];
	}

	public set sourceDatabaseName(value: string) {
		this.options['sourceDatabaseName'] = value;
	}

	public get relocateDbFiles(): boolean {
		return this.options['relocateDbFiles'];
	}

	public set relocateDbFiles(value: boolean) {
		this.options['relocateDbFiles'] = value;
	}

	public get dataFileFolder(): string {
		return this.options['dataFileFolder'];
	}

	public set dataFileFolder(value: string) {
		this.options['dataFileFolder'] = value;
	}

	public get logFileFolder(): string {
		return this.options['logFileFolder'];
	}

	public set logFileFolder(value: string) {
		this.options['logFileFolder'] = value;
	}

	public get selectedBackupSets(): string[] {
		return this.options['selectedBackupSets'];
	}

	public set selectedBackupSets(value: string[]) {
		this.options['selectedBackupSets'] = value;
	}

	public get readHeaderFromMedia(): boolean {
		return this.options['readHeaderFromMedia'];
	}

	public set readHeaderFromMedia(value: boolean) {
		this.options['readHeaderFromMedia'] = value;
	}

	public get overwriteTargetDatabase(): boolean {
		return this.options['overwriteTargetDatabase'];
	}

	public set overwriteTargetDatabase(value: boolean) {
		this.options['overwriteTargetDatabase'] = value;
	}
}
