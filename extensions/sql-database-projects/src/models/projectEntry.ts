/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as utils from '../common/utils';
import { IDacpacReferenceSettings, INugetPackageReferenceSettings, IProjectReferenceSettings, IUserDatabaseReferenceSettings } from './IDatabaseReferenceSettings';
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

abstract class UserDatabaseReferenceProjectEntry extends FileProjectEntry {
	databaseSqlCmdVariableValue?: string;
	databaseSqlCmdVariableName?: string;
	databaseVariableLiteralValue?: string;
	serverSqlCmdVariableName?: string;
	serverSqlCmdVariableValue?: string;
	suppressMissingDependenciesErrors: boolean;

	constructor(settings: IUserDatabaseReferenceSettings, uri: Uri) {
		super(uri, /* relativePath doesn't get set for database references */ '', EntryType.DatabaseReference);
		this.suppressMissingDependenciesErrors = settings.suppressMissingDependenciesErrors;
		this.databaseVariableLiteralValue = settings.databaseVariableLiteralValue;
		this.databaseSqlCmdVariableName = settings.databaseName;
		this.databaseSqlCmdVariableValue = settings.databaseVariable;

		this.serverSqlCmdVariableName = settings.serverName;
		this.serverSqlCmdVariableValue = settings.serverVariable;
	}
}

export class DacpacReferenceProjectEntry extends UserDatabaseReferenceProjectEntry implements IDatabaseReferenceProjectEntry {
	constructor(settings: IDacpacReferenceSettings) {
		super(settings, settings.dacpacFileLocation,);
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

export class SqlProjectReferenceProjectEntry extends UserDatabaseReferenceProjectEntry implements IDatabaseReferenceProjectEntry {
	public projectName: string;
	public projectGuid: string;

	constructor(settings: IProjectReferenceSettings) {
		super(settings, settings.projectRelativePath!);

		this.projectName = settings.projectName;
		this.projectGuid = settings.projectGuid;
	}

	public get referenceName(): string {
		return this.projectName;
	}

	public override pathForSqlProj(): string {
		// need to remove the leading slash from path for build to work on Windows
		return utils.convertSlashesForSqlProj(this.fsUri.path.substring(1));
	}
}

export class NugetPackageReferenceProjectEntry extends UserDatabaseReferenceProjectEntry implements IDatabaseReferenceProjectEntry {
	packageName: string;

	constructor(settings: INugetPackageReferenceSettings) {
		super(settings, Uri.file(settings.packageName));
		this.packageName = settings.packageName;
	}

	public get referenceName(): string {
		return this.packageName;
	}

	public override pathForSqlProj(): string {
		return this.packageName;
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
