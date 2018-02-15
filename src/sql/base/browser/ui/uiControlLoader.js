/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

let ControlBuilder;

require(['sql/base/browser/ui/uiControlBuilder',
	], function(value) {
        ControlBuilder = value;
        parent.postMessage('modulesReady', '*');
    });

    window.addEventListener('message', (args) => {
        if (args && args.data && args.data.control && args.data.container) {
            ControlBuilder.addControl(args.data, getContainer(args.data.container));
        }
});

function getContainer(id) {
    return document.getElementById(id);
}