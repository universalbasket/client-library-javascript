# Contributing

Contributions are submitted by pull request.

## Versioning

To version this library (you may need to swap `origin` with `upstream`,
depending on how you cloned this repo):

- `git checkout master`
- `git pull origin master`
- `npm version <major|minor|patch>`
- `git push origin master --tags`
- `npm publish`

In words:

- Check out and update the master branch.
- Version using npm, (which also creates a git tag).
- Push master (`package.json` and `package-lock.json` now include an updated version number) and the new tag to origin.
- Publish the new version.
