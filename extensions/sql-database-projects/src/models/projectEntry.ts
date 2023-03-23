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
	databaseSqlCmdVariableValue?: string;
	databaseSqlCmdVariableName?: string;
	databaseVariableLiteralValue?: string;
	serverSqlCmdVariableName?: string;
	serverSqlCmdVariableValue?: string;
	suppressMissingDependenciesErrors: boolean;

	constructor(settings: IDacpacReferenceSettings) {
		super(settings.dacpacFileLocation, /* relativePath doesn't get set for database references */ '', EntryType.DatabaseReference);
		this.suppressMissingDependenciesErrors = settings.suppressMissingDependenciesErrors;

		this.databaseVariableLiteralValue = settings.databaseVariableLiteralValue;
		this.databaseSqlCmdVariableName = settings.databaseName;
		this.databaseSqlCmdVariableValue = settings.databaseVariable;

		this.serverSqlCmdVariableName = settings.serverName;
		this.serverSqlCmdVariableValue = settings.serverVariable;
	}

	/**
	 * File name that gets displayed in the project tree
	 */
	public get referenceName(): string {
		return path.parse(utils.getPlatformSafeFileEntryPath(this.fsUri.fsPath)).name;
	}

	public override pathForSqlProj(): string {
		// need to remove the leading slash from path for build to work
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}
}

export class SystemDatabaseReferenceProjectEntry extends FileProjectEntry implements IDatabaseReferenceProjectEntry {
	constructor(public referenceName: string, public databaseVariableLiteralValue: string | undefined, public suppressMissingDependenciesErrors: boolean) {
		super(Uri.file(referenceName), referenceName, EntryType.DatabaseReference);
	}

	/**
	 * Returns the name of the system database - this is used for deleting the system database reference
	 */
	public override pathForSqlProj(): string {
		return this.referenceName;
	}
}

export class SqlProjectReferenceProjectEntry extends FileProjectEntry implements IDatabaseReferenceProjectEntry {
	public projectName: string;
	public projectGuid: string;
	public databaseVariableLiteralValue?: string;
	public databaseSqlCmdVariableName?: string;
	public databaseSqlCmdVariableValue?: string;
	public serverSqlCmdVariableName?: string;
	public serverSqlCmdVariableValue?: string;
	public suppressMissingDependenciesErrors: boolean;

	constructor(settings: IProjectReferenceSettings) {
		super(settings.projectRelativePath!, /* relativePath doesn't get set for database references */ '', EntryType.DatabaseReference);

		this.projectName = settings.projectName;
		this.projectGuid = settings.projectGuid;
		this.suppressMissingDependenciesErrors = settings.suppressMissingDependenciesErrors;

		this.databaseVariableLiteralValue = settings.databaseVariableLiteralValue;
		this.databaseSqlCmdVariableName = settings.databaseName;
		this.databaseSqlCmdVariableValue = settings.databaseVariable;

		this.serverSqlCmdVariableName = settings.serverName;
		this.serverSqlCmdVariableValue = settings.serverVariable;
	}

	public get referenceName(): string {
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
