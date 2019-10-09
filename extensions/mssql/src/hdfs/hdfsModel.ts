/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFileSource } from '../objectExplorerNodeProvider/fileSources';
import { PermissionStatus, AclEntry, AclEntryScope, AclType, AclEntryPermission } from './aclEntry';
import { FileStatus } from './fileStatus';

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

	constructor(private fileSource: IFileSource, private path: string) {
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
		if (!this.permissionStatus) {
			return;
		}
		const newEntry = new AclEntry(AclEntryScope.access, type, name, name, new AclEntryPermission(true, true, true));
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
	public apply(recursive: boolean = false): Promise<any> {
		// TODO Apply recursive
		return Promise.all([
			this.fileSource.setAcl(this.path, this.permissionStatus.owner, this.permissionStatus.group, this.permissionStatus.other, this.permissionStatus.aclEntries),
			this.fileSource.setPermission(this.path, this.permissionStatus)]);
	}
}
