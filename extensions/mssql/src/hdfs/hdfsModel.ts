/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileSource } from '../objectExplorerNodeProvider/fileSources';
import * as vscode from 'vscode';
import { IAclStatus, AclEntry, AclEntryScope, AclEntryType, AclEntryPermission } from './aclEntry';

export class HdfsModel {

	private readonly _onAclStatusUpdated = new vscode.EventEmitter<IAclStatus>();
	public onAclStatusUpdated = this._onAclStatusUpdated.event;

	public aclStatus: IAclStatus;

	constructor(private fileSource: IFileSource, private path: string) {
		this.refresh();
	}

	public async refresh(): Promise<void> {
		// await this.fileSource.setAcl(this.path, parseAcl('user:bob:r--,user::rwx,group::r--,other::rwx'));
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


	public apply(recursive: boolean = false): Promise<void> {
		return this.fileSource.setAcl(this.path, this.aclStatus.owner, this.aclStatus.group, this.aclStatus.other, this.aclStatus.entries);
	}
}
