# Contributing

`develop` is the integration and default branch. `main` contains published releases.

- Base contribution branches on current `develop`; every contribution PR must target `develop`.
- Use `gh pr create --base develop`. Verify the base after creation and before merging with `gh pr view --json baseRefName --jq .baseRefName`.
- Maintainer and agent tasks follow [AGENTS.md](../AGENTS.md): approved plan, task branch and worktree, relevant validation and independent review, then integration and push to `develop`.
- External contributors may use any branch name. Describe the change and its validation. Never commit credentials or private customer data.
- Only explicitly authorized release work updates `main`. Never use release credentials for ordinary contributions.

## Release authentication

`release.sh` automatically uses the shared launcher at `~/repos/helpmonks-install-script/scripts/github-app-release/release.mjs`. Keep that checkout current. The launcher uses the `Nitai Release` App for Git and retains ordinary `gh` credentials for workflow dispatch and registry login.

Keep the key at `~/.config/github-apps/nitai-release/private-key.pem` with directory mode `700` and file mode `600`. Check access without publishing using `node ~/repos/helpmonks-install-script/scripts/github-app-release/release.mjs --check`. Script `--help` and `--dry-run` do not require the key.

Two GitHub rulesets protect `main`: history protection blocks deletion and force pushes with no bypass; update restriction permits only the release App. The App key can authorize writes within its installed repositories, and administrators can change these settings. See the [shared authentication and ruleset guide](https://github.com/Helpmonks/helpmonks-install-script/blob/master/scripts/github-app-release/README.md).
