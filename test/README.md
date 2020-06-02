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

## Code Coverage

To generate a report combining the code coverage for extensions + core run `node ./test/combineCoverage`. Currently this will combine coverage from the Core Unit Tests, Extension Unit Tests and Extension Integration tests - see above docs for instructions on how to run those to generate coverage.

Once ran the combined coverage report will be located in `./test/coverage`.
