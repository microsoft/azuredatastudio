/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { IFileSource } from '../objectExplorerNodeProvider/fileSources';
import { IAclStatus, AclEntry, AclEntryScope, AclEntryType, AclEntryPermission } from './aclEntry';

/**
 * Model for storing the state of a specified file/folder in HDFS
 */
export class HdfsModel {

	private readonly _onAclStatusUpdated = new vscode.EventEmitter<IAclStatus>();
	/**
	 * Event that's fired anytime changes are made by the model to the ACLStatus
	 */
	public onAclStatusUpdated = this._onAclStatusUpdated.event;

	/**
	 * The ACL status of the file/folder
	 */
	public aclStatus: IAclStatus;

	constructor(private fileSource: IFileSource, private path: string) {
		this.refresh();
	}

	/**
	 * Refresh the ACL status with the current values on HDFS
	 */
	public async refresh(): Promise<void> {
		this.aclStatus = await this.fileSource.getAclStatus(this.path);
		this._onAclStatusUpdated.fire(this.aclStatus);
	}

	/**
	 * Creates a new ACL Entry and adds it to the list of current entries. Will do nothing
	 * if a duplicate entry (@see AclEntry.isEqual) exists
	 * @param name The name of the ACL Entry
	 * @param type The type of ACL to create
	 */
	public createAndAddAclEntry(name: string, type: AclEntryType): void {
		if (!this.aclStatus) {
			return;
		}
		const newEntry = new AclEntry(AclEntryScope.access, type, name, name, new AclEntryPermission(true, true, true));
		// Don't add duplicates. This also checks the owner, group and other items
		if ([this.aclStatus.owner, this.aclStatus.group, this.aclStatus.other].concat(this.aclStatus.entries).find(entry => entry.isEqual(newEntry))) {
			return;
		}

		this.aclStatus.entries.push(newEntry);
		this._onAclStatusUpdated.fire(this.aclStatus);
	}

	/**
	 * Deletes the specified entry from the list of registered
	 * @param entryToDelete The entry to delete
	 */
	public deleteAclEntry(entryToDelete: AclEntry): void {
		this.aclStatus.entries = this.aclStatus.entries.filter(entry => !entry.isEqual(entryToDelete));
		this._onAclStatusUpdated.fire(this.aclStatus);
	}


	/**
	 * Applies the changes made to this model to HDFS. Note that this will overwrite ALL permissions so any
	 * permissions that shouldn't change need to still exist and have the same values.
	 * @param recursive Whether to apply the changes recursively (to all sub-folders and files)
	 */
	public apply(recursive: boolean = false): Promise<void> {
		// TODO Apply recursive
		return this.fileSource.setAcl(this.path, this.aclStatus.owner, this.aclStatus.group, this.aclStatus.other, this.aclStatus.entries);
	}
}
