/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileType } from '../objectExplorerNodeProvider/fileSources';

export const enum HdfsFileType {
	File = 'File',
	Directory = 'Directory',
	Symlink = 'Symlink'
}

/**
 * Maps a @see HdfsFileType to its corresponding @see FileType. Will return undefined if
 * passed in type is undefined.
 * @param hdfsFileType The HdfsFileType to map from
 */
export function hdfsFileTypeToFileType(hdfsFileType: HdfsFileType | undefined): FileType | undefined {
	switch (hdfsFileType) {
		case HdfsFileType.Directory:
			return FileType.Directory;
		case HdfsFileType.File:
			return FileType.File;
		case HdfsFileType.Symlink:
			return FileType.Symlink;
		case undefined:
			return undefined;
		default:
			throw new Error(`Unexpected file type ${hdfsFileType}`);
	}
}

export class FileStatus {
	/**
	 *
	 * @param owner The ACL entry object for the owner permissions
	 * @param group The ACL entry object for the group permissions
	 * @param other The ACL entry object for the other permissions
	 * @param stickyBit The sticky bit status for the object. If true the owner/root are
	 * the only ones who can delete the resource or its contents (if a folder)
	 * @param aclEntries The ACL entries defined for the object
	 */
	constructor(
		/**
		 * Access time for the file
		 */
		public readonly accessTime: string,
		/**
		 * The block size of a file.
		 */
		public readonly blockSize: string,
		/**
		 * The group owner.
		 */
		public readonly group: string,
		/**
		 * The number of bytes in a file. (0 for directories)
		 */
		public readonly length: string,
		/**
		 * The modification time.
		 */
		public readonly modificationTime: string,
		/**
		 * The user who is the owner.
		 */
		public readonly owner: string,
		/**
		 * The path suffix.
		 */
		public readonly pathSuffix: string,
		/**
		 * The permission represented as a octal string.
		 */
		public readonly permission: string,
		/**
		 * The number of replication of a file.
		 */
		public readonly replication: string,
		/**
		 * Whether a directory is snapshot enabled or not
		 */
		public readonly snapshotEnabled: string,
		/**
		 * The type of the path object.
		 */
		public readonly type: HdfsFileType
	) { }
}

/**
 * Parses a fileType string into the corresponding @see HdfsFileType
 * @param fileType The fileType string to parse
 */
export function parseHdfsFileType(fileType: string): HdfsFileType {
	switch (fileType.toLowerCase()) {
		case 'file':
			return HdfsFileType.File;
		case 'directory':
			return HdfsFileType.Directory;
		case 'symlink':
			return HdfsFileType.Symlink;
		default:
			throw new Error(`Unknown HdfsFileType '${fileType}'`);
	}
}
