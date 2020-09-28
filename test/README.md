# Azure Data Studio Tests

## Contents

This folder contains the various test runners for Azure Data Studio. Please refer to the documentation within for how to run them:
* `unit`: our suite of unit tests ([README](unit/README.md))
* `integration`: our suite of API tests ([README](integration/browser/README.md))
* `smoke`: our suite of automated UI tests ([README](smoke/README.md))
* `ui`: our suite of manual UI tests

## Extension Tests

In addition to the above core tests many extensions in this repo also have tests themselves. These are split into two categories.

### Unit tests

These are smaller tests that don't need connections to outside resources such as SQL instances. They are still ran within the context of Azure Data Studio and so have access to all the normal APIs as they would during runtime.

Run these with the script `./scripts/test-extensions-unit.[bat|sh]`

Code coverage is enabled by default. Reports can be found in the coverage folder at the root of the folder for each extension that ran.


### Integration tests

These are the group of tests that have dependencies on outside resources such as SQL instances. See the [README](../extensions/integration-tests/readme.md) for more information.

Code coverage for this is also enabled by default (confined to the extensions), follow the instructions for running the tests in the above readme.

### Stubbing vscode/azdata/library APIs

Sometimes it may be necessary to stub out certain vscode/azdata APIs or functionality from external libraries to modify the normal behavior. A few examples of when this may be necessary :

* Mocking out dialogs such as the `Open File` dialog in tests that don't have UI interaction (such as Unit tests)
* Mocking out network calls such as from the `request` library

Note that you should try to avoid using this unless absolutely necessary. For example - instead of stubbing out a call to `vscode.window.showTextDocument` it's better to call the actual VS Code API and have it open the document instead. Just make sure that everything is cleaned up after each test run so that following tests aren't affected by stale state!

We utilize the `Sinon` framework to accomplish handling these kinds of scenarios. See https://sinonjs.org/releases/latest/stubs/ for a general overview of the use of stubs in this manner.

https://mherman.org/blog/stubbing-http-requests-with-sinon/ has an excellent tutorial on stubbing out API calls for the request framework.

The same principle can be applied to the vscode/azdata APIs. The object in this case is the imported vscode/azdata module, here is an example of stubbing out the `vscode.window.showOpenDialog` function.

`sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([vscode.Uri.file('C:\test\path.txt')]));`

**IMPORTANT** When using Sinon make sure to call `sinon.restore()` after every test run (using `afterEach` typically) to ensure that the stub doesn't affect other tests.

## Code Coverage

To generate a report combining the code coverage for extensions + core run `node ./test/combineCoverage`. Currently this will combine coverage from the Core Unit Tests, Extension Unit Tests and Extension Integration tests - see above docs for instructions on how to run those to generate coverage.

Once ran the combined coverage report will be located in `./test/coverage`.
