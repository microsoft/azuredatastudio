/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vfs = require("vinyl-fs");
const path = require("path");
const es = require("event-stream");
const fs = require("fs");
const files = [
    '.build/langpacks/**/*.vsix',
    '.build/extensions/**/*.vsix',
    '.build/win32-x64/**/*.{exe,zip}',
    '.build/win32-arm64/**/*.{exe,zip}',
    '.build/linux/sha256hashes.txt',
    '.build/linux/deb/amd64/deb/*.deb',
    '.build/linux/rpm/x86_64/*.rpm',
    '.build/linux/server/*',
    '.build/linux/archive/*',
    '.build/docker/*',
    '.build/darwin/*',
    '.build/version.json' // version information
];
async function main() {
    return new Promise((resolve, reject) => {
        const stream = vfs.src(files, { base: '.build', allowEmpty: true })
            .pipe(es.through(file => {
            const filePath = path.join(process.env.BUILD_ARTIFACTSTAGINGDIRECTORY, 
            //Preserve intermediate directories after .build folder
            file.path.substr(path.resolve('.build').length + 1));
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.renameSync(file.path, filePath);
        }));
        stream.on('end', () => resolve());
        stream.on('error', e => reject(e));
    });
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29weUFydGlmYWN0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvcHlBcnRpZmFjdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztnR0FHZ0c7QUFFaEcsWUFBWSxDQUFDOztBQUViLGdDQUFnQztBQUNoQyw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLHlCQUF5QjtBQUV6QixNQUFNLEtBQUssR0FBRztJQUNiLDRCQUE0QjtJQUM1Qiw2QkFBNkI7SUFDN0IsaUNBQWlDO0lBQ2pDLG1DQUFtQztJQUNuQywrQkFBK0I7SUFDL0Isa0NBQWtDO0lBQ2xDLCtCQUErQjtJQUMvQix1QkFBdUI7SUFDdkIsd0JBQXdCO0lBQ3hCLGlCQUFpQjtJQUNqQixpQkFBaUI7SUFDakIscUJBQXFCLENBQUMsc0JBQXNCO0NBQzVDLENBQUM7QUFFRixLQUFLLFVBQVUsSUFBSTtJQUNsQixPQUFPLElBQUksT0FBTyxDQUFPLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQzVDLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUM7YUFDakUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDdkIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLDhCQUErQjtZQUNyRSx1REFBdUQ7WUFDdkQsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0RCxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUMxRCxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDcEMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVMLE1BQU0sQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbEMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwQyxDQUFDLENBQUMsQ0FBQztBQUNKLENBQUM7QUFFRCxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7SUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNuQixPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pCLENBQUMsQ0FBQyxDQUFDIn0=