/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import * as json from 'vs/base/common/json';
import * as pfs from 'vs/base/node/pfs';
import { URI } from 'vs/base/common/uri';

import ContentManager = nb.ContentManager;

export class LocalContentManager implements ContentManager {
    public async getNotebookContents(notebookUri: URI): Promise<nb.INotebookContents> {
        if (!notebookUri) {
            return undefined;
        }
        // TODO validate this is an actual file URI, and error if not
        let path = notebookUri.fsPath;
        // Note: intentionally letting caller handle exceptions
        let notebookFileBuffer = await pfs.readFile(path);
        return <nb.INotebookContents>json.parse(notebookFileBuffer.toString());
    }

    public async save(notebookUri: URI, notebook: nb.INotebookContents): Promise<nb.INotebookContents> {
        // Convert to JSON with pretty-print functionality
        let contents = JSON.stringify(notebook, undefined, '    ');
        let path = notebookUri.fsPath;
        await pfs.writeFile(path, contents);
        return notebook;
    }
}
