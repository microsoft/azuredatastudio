/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { IFileSource, FileType } from '../objectExplorerNodeProvider/fileSources';
import { PermissionStatus, AclEntry, AclEntryScope, AclType, AclEntryPermission } from './aclEntry';
import { FileStatus, hdfsFileTypeToFileType } from './fileStatus';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

/**
 * Model for storing the state of a specified file/folder in HDFS
 */
export class HdfsModel {

	private readonly _onPermissionStatusUpdated = new vscode.EventEmitter<PermissionStatus>();
	/**
	 * Event that's fired anytime changes are made by the model to the @see PermissionStatus
	 */
	public onPermissionStatusUpdated = this._onPermissionStatusUpdated.event;

	/**
	 * The @see PermissionStatus of the file/folder
	 */
	public permissionStatus: PermissionStatus;

	/**
	 * The @see FileStatus of the file/folder
	 */
	public fileStatus: FileStatus;

	constructor(private readonly fileSource: IFileSource, private readonly path: string) {
		this.refresh();
	}

	/**
	 * Refresh the ACL status with the current values on HDFS
	 */
	public async refresh(): Promise<void> {
		[this.permissionStatus, this.fileStatus] = await Promise.all([
			this.fileSource.getAclStatus(this.path),
			this.fileSource.getFileStatus(this.path)]);
		this._onPermissionStatusUpdated.fire(this.permissionStatus);
	}

	/**
	 * Creates a new ACL Entry and adds it to the list of current entries. Will do nothing
	 * if a duplicate entry (@see AclEntry.isEqual) exists
	 * @param name The name of the ACL Entry
	 * @param type The type of ACL to create
	 */
	public createAndAddAclEntry(name: string, type: AclType): void {
		if (!this.permissionStatus || !name || name.length < 1) {
			return;
		}
		const newEntry = new AclEntry(type, name, name);
		newEntry.addPermission(AclEntryScope.access, new AclEntryPermission(true, true, true));
		// Don't add duplicates. This also checks the owner, group and other items
		if ([this.permissionStatus.owner, this.permissionStatus.group, this.permissionStatus.other].concat(this.permissionStatus.aclEntries).find(entry => entry.isEqual(newEntry))) {
			return;
		}

		this.permissionStatus.aclEntries.push(newEntry);
		this._onPermissionStatusUpdated.fire(this.permissionStatus);
	}

	/**
	 * Deletes the specified entry from the list of registered
	 * @param entryToDelete The entry to delete
	 */
	public deleteAclEntry(entryToDelete: AclEntry): void {
		this.permissionStatus.aclEntries = this.permissionStatus.aclEntries.filter(entry => !entry.isEqual(entryToDelete));
		this._onPermissionStatusUpdated.fire(this.permissionStatus);
	}


	/**
	 * Applies the changes made to this model to HDFS. Note that this will overwrite ALL permissions so any
	 * permissions that shouldn't change need to still exist and have the same values.
	 * @param recursive Whether to apply the changes recursively (to all sub-folders and files)
	 */
	public async apply(recursive: boolean = false): Promise<void> {
		await this.applyAclChanges(this.path, hdfsFileTypeToFileType(this.fileStatus ? this.fileStatus.type : undefined));
		if (recursive) {
			azdata.tasks.startBackgroundOperation(
				{
					connection: undefined,
					displayName: localize('mssql.recursivePermissionOpStarted', "Applying permission changes recursively under '{0}'", this.path),
					description: '',
					isCancelable: false,
					operation: async op => {
						await this.applyToChildrenRecursive(op, this.path);
						op.updateStatus(azdata.TaskStatus.Succeeded, localize('mssql.recursivePermissionOpSucceeded', "Permission changes applied successfully."));
					}
				}
			);
		}
	}

	/**
	 * Recursive call to apply the current set of changes to all children of this path (if any)
	 * @param op Background operation used to track status of the task
	 * @param path The path
	 */
	private async applyToChildrenRecursive(op: azdata.BackgroundOperation, path: string): Promise<void> {
		try {
			op.updateStatus(azdata.TaskStatus.InProgress, localize('mssql.recursivePermissionOpProgress', "Applying permission changes to '{0}'.", path));
			const files = await this.fileSource.enumerateFiles(path, true);
			// Apply changes to all children of this path and then recursively apply to children of any directories
			await Promise.all(
				files.map(file => this.applyAclChanges(file.path, file.fileType)).concat(
					files.filter(f => f.fileType === FileType.Directory).map(d => this.applyToChildrenRecursive(op, d.path)))
			);
		} catch (error) {
			const errMsg = localize('mssql.recursivePermissionOpError', "Error applying permission changes: {0}", (error instanceof Error ? error.message : error));
			vscode.window.showErrorMessage(errMsg);
			op.updateStatus(azdata.TaskStatus.Failed, errMsg);
		}
	}

	/**
	 * Applies the current set of Permissions/ACLs to the specified path
	 * @param path The path to apply the changes to
	 */
	private async applyAclChanges(path: string, fileType: FileType | undefined): Promise<any> {
		// HDFS won't remove existing default ACLs even if you call setAcl with no default ACLs specified. You
		// need to call removeDefaultAcl specifically to remove them.
		if (!this.permissionStatus.owner.getPermission(AclEntryScope.default) &&
			!this.permissionStatus.group.getPermission(AclEntryScope.default) &&
			!this.permissionStatus.other.getPermission(AclEntryScope.default)) {
			await this.fileSource.removeDefaultAcl(path);
		}
		return Promise.all([
			this.fileSource.setAcl(path, fileType, this.permissionStatus),
			this.fileSource.setPermission(path, this.permissionStatus)]);
	}
}


