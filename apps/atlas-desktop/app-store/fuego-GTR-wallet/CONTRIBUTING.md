# Contributing to FuegoGT Wallet

Thank you for your interest in contributing to FuegoGT Wallet! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **Rust** 1.70+ with Cargo
- **Git** for version control
- **System Dependencies** (see README.md)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fuego-GTR-wallet.git
   cd fuego-GTR-wallet/fuego-tauri
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run tauri:dev
   ```

## 📋 Contribution Guidelines

### Code Style

#### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Use async/await instead of Promises when possible

#### Rust
- Follow Rust naming conventions
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Add documentation comments for public items
- Use `Result<T, E>` for error handling

#### CSS
- Use CSS custom properties for theming
- Follow BEM methodology for class naming
- Use modern CSS features (Grid, Flexbox)
- Ensure responsive design

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(wallet): add term deposit functionality
fix(ui): resolve sync progress display issue
docs(readme): update installation instructions
```

### Pull Request Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make Changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test Your Changes**
   ```bash
   npm test
   cargo test
   npm run tauri:build
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Create Pull Request**
   - Use descriptive title and description
   - Reference related issues
   - Add screenshots for UI changes
   - Ensure all checks pass

## 🧪 Testing

### Frontend Tests
```bash
npm test
npm run test:coverage
```

### Backend Tests
```bash
cargo test
cargo test -- --nocapture  # For verbose output
```

### Integration Tests
```bash
npm run test:integration
```

### Manual Testing
- Test on all supported platforms
- Verify security features
- Check accessibility compliance
- Test with different languages

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Environment**
   - Operating System and version
   - Node.js version
   - Rust version
   - Browser (if applicable)

2. **Steps to Reproduce**
   - Clear, numbered steps
   - Expected vs actual behavior
   - Screenshots or videos if helpful

3. **Additional Information**
   - Error messages or logs
   - Related issues
   - Workarounds if any

## 💡 Feature Requests

When suggesting features:

1. **Check Existing Issues**
   - Search for similar requests
   - Comment on existing issues if relevant

2. **Provide Context**
   - Use case and motivation
   - Expected behavior
   - Potential implementation ideas

3. **Consider Impact**
   - Security implications
   - Performance considerations
   - User experience impact

## 🔒 Security

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email [security@fuego.network](mailto:security@fuego.network)
2. Include detailed description
3. Provide steps to reproduce
4. Wait for response before disclosure

### Security Guidelines

- Never commit secrets or API keys
- Use secure coding practices
- Validate all user inputs
- Follow OWASP guidelines
- Keep dependencies updated

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for TypeScript functions
- Add Rust documentation comments
- Update README.md for new features
- Include examples in documentation

### User Documentation
- Update user guides for new features
- Add screenshots for UI changes
- Translate documentation for supported languages

## 🌍 Internationalization

### Adding New Languages
1. Add language files to `src-tauri/src/i18n/`
2. Update language list in configuration
3. Test RTL support for Arabic/Hebrew
4. Update documentation

### Translation Guidelines
- Use clear, concise language
- Maintain consistency with existing translations
- Consider cultural context
- Test with native speakers

## 🏗️ Architecture

### Project Structure
- **Frontend**: `src/` - TypeScript, HTML, CSS
- **Backend**: `src-tauri/src/` - Rust modules
- **FFI**: `src-tauri/fuego_wallet_real.cpp` - C++ integration
- **Config**: `tauri.conf.json` - Tauri configuration

### Module Organization
- `crypto/` - CryptoNote integration
- `security/` - Security features
- `performance/` - Performance optimization
- `settings/` - Settings management
- `backup/` - Backup & recovery
- `i18n/` - Internationalization
- `optimization/` - Advanced optimization
- `advanced/` - Advanced features

## 🚀 Release Process

### Version Numbering
- Follow [Semantic Versioning](https://semver.org/)
- Major: Breaking changes
- Minor: New features
- Patch: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Security audit completed
- [ ] Cross-platform builds successful
- [ ] Release notes prepared

## 🤝 Community

### Getting Help
- **GitHub Discussions**: For questions and discussions
- **GitHub Issues**: For bug reports and feature requests
- **Discord**: For real-time community chat
- **Email**: For security issues

### Code of Conduct
- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect different viewpoints
- Follow the [Contributor Covenant](https://www.contributor-covenant.org/)

## 📄 License

By contributing to FuegoGT Wallet, you agree that your contributions will be licensed under the MIT License.

## 🙏 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation
- Community acknowledgments

Thank you for contributing to FuegoGT Wallet! 🚀
