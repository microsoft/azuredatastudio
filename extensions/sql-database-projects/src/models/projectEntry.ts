/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as utils from '../common/utils';
import { IDacpacReferenceSettings, IProjectReferenceSettings } from './IDatabaseReferenceSettings';
import { EntryType, IDatabaseReferenceProjectEntry, IFileProjectEntry, IProjectEntry } from 'sqldbproj';
import { Uri } from 'vscode';

/**
 * Represents an entry in a project file
 */
export abstract class ProjectEntry implements IProjectEntry {

	constructor(public type: EntryType) { }
}

export class FileProjectEntry extends ProjectEntry implements IFileProjectEntry {
	/**
	 * Absolute file system URI
	 */
	fsUri: Uri;
	relativePath: string;
	sqlObjectType: string | undefined;
	containsCreateTableStatement: boolean | undefined;

	constructor(uri: Uri, relativePath: string, entryType: EntryType, sqlObjectType?: string, containsCreateTableStatement?: boolean) {
		super(entryType);
		this.fsUri = uri;
		this.relativePath = relativePath;
		this.sqlObjectType = sqlObjectType;
		this.containsCreateTableStatement = containsCreateTableStatement;
	}

	public override toString(): string {
		return this.fsUri.path;
	}

	public pathForSqlProj(): string {
		return utils.convertSlashesForSqlProj(this.fsUri.fsPath);
	}
}

export class DacpacReferenceProjectEntry extends FileProjectEntry implements IDatabaseReferenceProjectEntry {
	databaseVariableLiteralValue?: string;
	databaseSqlCmdVariable?: string;
	serverName?: string;
	serverSqlCmdVariable?: string;
	suppressMissingDependenciesErrors: boolean;

	constructor(settings: IDacpacReferenceSettings) {
		super(settings.dacpacFileLocation, '', EntryType.DatabaseReference);
		this.databaseSqlCmdVariable = settings.databaseVariable;
		this.databaseVariableLiteralValue = settings.databaseName;
		this.serverName = settings.serverName;
		this.serverSqlCmdVariable = settings.serverVariable;
		this.suppressMissingDependenciesErrors = settings.suppressMissingDependenciesErrors;
	}

	/**
	 * File name that gets displayed in the project tree
	 */
	public get databaseName(): string {
		return path.parse(utils.getPlatformSafeFileEntryPath(this.fsUri.fsPath)).name;
	}

	public override pathForSqlProj(): string {
		// need to remove the leading slash from path for build to work
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}
}

export class SystemDatabaseReferenceProjectEntry extends FileProjectEntry implements IDatabaseReferenceProjectEntry {
	constructor(uri: Uri, public ssdtUri: Uri, public databaseVariableLiteralValue: string | undefined, public suppressMissingDependenciesErrors: boolean) {
		super(uri, '', EntryType.DatabaseReference);
	}

	/**
	 * File name that gets displayed in the project tree
	 */
	public get databaseName(): string {
		return path.parse(utils.getPlatformSafeFileEntryPath(this.fsUri.fsPath)).name;
	}

	public override pathForSqlProj(): string {
		// need to remove the leading slash for system database path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}

	public ssdtPathForSqlProj(): string {
		// need to remove the leading slash for system database path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.ssdtUri.path.substring(1));
	}
}

export class SqlProjectReferenceProjectEntry extends FileProjectEntry implements IDatabaseReferenceProjectEntry {
	projectName: string;
	projectGuid: string;
	databaseVariableLiteralValue?: string;
	databaseSqlCmdVariable?: string;
	serverName?: string;
	serverSqlCmdVariable?: string;
	suppressMissingDependenciesErrors: boolean;

	constructor(settings: IProjectReferenceSettings) {
		super(settings.projectRelativePath!, '', EntryType.DatabaseReference);
		this.projectName = settings.projectName;
		this.projectGuid = settings.projectGuid;
		this.databaseSqlCmdVariable = settings.databaseVariable;
		this.databaseVariableLiteralValue = settings.databaseName;
		this.serverName = settings.serverName;
		this.serverSqlCmdVariable = settings.serverVariable;
		this.suppressMissingDependenciesErrors = settings.suppressMissingDependenciesErrors;
	}

	public get databaseName(): string {
		return this.projectName;
	}

	public override pathForSqlProj(): string {
		// need to remove the leading slash from path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}
}

export class SqlCmdVariableProjectEntry extends ProjectEntry {
	constructor(public variableName: string, public defaultValue: string) {
		super(EntryType.SqlCmdVariable);
	}
}

export enum DatabaseReferenceLocation {
	sameDatabase,
	differentDatabaseSameServer,
	differentDatabaseDifferentServer
}

export enum SystemDatabase {
	master,
	msdb
}
