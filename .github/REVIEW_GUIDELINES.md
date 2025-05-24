## Reviewer Guidelines 🧠

Please keep these principles in mind while reviewing or submitting a PR:

### Author Responsibilities
- **Be descriptive.** Include relevant context, especially for UX-affecting or feature-level changes.
- **Keep it focused.** Don’t combine unrelated features, refactors, or style changes in a single PR.
- **Add tests.** Include or update unit/integration tests where possible.
- **Tag reviewers.** Assign reviewers familiar with the code area or issue.
- **Surface important diffs.** Use comments to draw attention to anything non-obvious or potentially controversial.
- **Ensure stability.** Double-check that this change doesn’t break core features like connection flow, query execution, or the editor UI.
- **Follow up.** Don’t complete PRs with unresolved threads unless explicitly delegated.

### Reviewer Responsibilities
- **Understand the context.** Read the PR description before reviewing code.
- **Don't rubber-stamp.** Approve only after reviewing the actual code changes.
- **Request missing tests.** If there’s logic but no tests, ask why.
- **Call out breaking behavior.** Note anything that might affect extensions, users, or existing workflows.

## Additional Notes

*Add anything extra reviewers should be aware of – links to specs, design docs, screenshots, test logs, telemetry updates, or any TODOs still in scope.*