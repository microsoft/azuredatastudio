/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, '../../../');
function findFiles(location, pattern, result) {
    const entries = fs.readdirSync(path.join(ROOT, location));
    for (const entry of entries) {
        const entryPath = `${location}/${entry}`;
        let stat;
        try {
            stat = fs.statSync(path.join(ROOT, entryPath));
        }
        catch (err) {
            continue;
        }
        if (stat.isDirectory()) {
            findFiles(entryPath, pattern, result);
        }
        else {
            if (stat.isFile() && entry.endsWith(pattern)) {
                result.push(path.join(ROOT, entryPath));
            }
        }
    }
}
const shasum = crypto.createHash('sha1');
/**
 * Creating a sha hash of all the files that can cause packages to change/redownload.
 */
shasum.update(fs.readFileSync(path.join(ROOT, 'build/.cachesalt')));
shasum.update(fs.readFileSync(path.join(ROOT, '.yarnrc')));
// Adding all yarn.lock files into sha sum.
const result = [];
findFiles('', 'yarn.lock', result);
result.forEach(f => shasum.update(fs.readFileSync(f)));
// Add any other command line arguments
for (let i = 2; i < process.argv.length; i++) {
    shasum.update(process.argv[i]);
}
process.stdout.write(shasum.digest('hex'));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FsLWNvbXB1dGVOb2RlTW9kdWxlc0NhY2hlS2V5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3FsLWNvbXB1dGVOb2RlTW9kdWxlc0NhY2hlS2V5LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Z0dBR2dHO0FBRWhHLFlBQVksQ0FBQzs7QUFFYix5QkFBeUI7QUFDekIsNkJBQTZCO0FBQzdCLGlDQUFpQztBQUVqQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztBQUUvQyxTQUFTLFNBQVMsQ0FBQyxRQUFnQixFQUFFLE9BQWUsRUFBRSxNQUFnQjtJQUNyRSxNQUFNLE9BQU8sR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFMUQsS0FBSyxNQUFNLEtBQUssSUFBSSxPQUFPLEVBQUU7UUFDNUIsTUFBTSxTQUFTLEdBQUcsR0FBRyxRQUFRLElBQUksS0FBSyxFQUFFLENBQUM7UUFDekMsSUFBSSxJQUFjLENBQUM7UUFDbkIsSUFBSTtZQUNILElBQUksR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7U0FDL0M7UUFBQyxPQUFPLEdBQUcsRUFBRTtZQUNiLFNBQVM7U0FDVDtRQUNELElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxFQUFFO1lBQ3ZCLFNBQVMsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ3RDO2FBQU07WUFDTixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUM3QyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUM7YUFDeEM7U0FDRDtLQUNEO0FBQ0YsQ0FBQztBQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7QUFFekM7O0dBRUc7QUFDSCxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUUzRCwyQ0FBMkM7QUFDM0MsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO0FBQzVCLFNBQVMsQ0FBQyxFQUFFLEVBQUUsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ25DLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRXZELHVDQUF1QztBQUN2QyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDN0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Q0FDL0I7QUFFRCxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMifQ==