## Summary

<!-- Brief description of the changes introduced by this pull request. -->

## Related issue

<!-- If applicable, link the issue: Fixes #123 or Relates to #456 -->

## Type of change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing recipes or APIs to behave differently)
- [ ] Documentation / Example recipe
- [ ] Tooling / Monorepo maintenance

## Quality checklist

Before submitting, please ensure you have completed the following:

- [ ] Code formatted with Biome (`bun run lint:fix`)
- [ ] TypeScript types validated (`bun run typecheck`)
- [ ] Package tests passing (`bun test`)
- [ ] Golden conformance suite passing (`bun run conformance`)
- [ ] If changing a published package, a changeset is included (`bun run change`)
- [ ] Rebuilt packages before testing downstream packages (`bun run build`)
