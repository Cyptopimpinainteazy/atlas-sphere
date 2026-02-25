# Pull Request Template

## Summary

<!-- Describe the change at a high level. -->

## Description

<!-- Describe what this PR does and why -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Security fix

## Components Affected

- [ ] X3 Kernel (pallet)
- [ ] EVM Adapter / Integration
- [ ] SVM Adapter / Integration
- [ ] Runtime
- [ ] Node
- [ ] RPC
- [ ] CLI Tools
- [ ] Documentation
- [ ] CI/CD

## Testing

<!-- Describe tests you ran and how to reproduce them -->

- [ ] Unit tests pass (`cargo test --all`)
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] New tests added for changes

## Checklist

- [ ] I added/updated Alembic migrations if needed.
- [ ] **If** adding an Alembic migration, I included an orphaned-sequence guard or added a `# sequence-guard` comment.
- [ ] If you want the non-blocking Alembic roundtrip check to run on this PR, add the label: `run-alembic-roundtrip`.
- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Security Considerations

<!-- For security-sensitive changes, describe the security implications -->

- [ ] This change has security implications
- [ ] Security review requested (add `security` label)

## Breaking Changes

<!-- If this is a breaking change, describe what breaks and migration steps -->

## Related Issues

<!-- Link any related issues -->

Closes #

## Screenshots (if applicable)

<!-- Add screenshots to help explain your changes -->
