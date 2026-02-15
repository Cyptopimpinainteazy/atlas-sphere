# Security Policy

## 🔒 Supported Versions

We'll provide security updates for the following versions of Fuego GTR Wallet:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 🚨 Reporting Vulnerabilities

The security of Fuego's L1 network (& wallets) is paramount. If you discover a security vulnerability, please follow these simple guidelines:

### PLEASE ⚠️ DO NOT
- Create a public GitHub issue
- Discuss the vulnerability publicly
- Share details on social media
- Contact individual maintainers directly

### PLEASE ✅ DO
1. **Email Fuego Security Response Team privately** at [fuegosecurity@proton.me](mailto:fuegosecurity@proton.me)
2. **Include detailed information**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fixes (if any)
3. **PLEASE WAIT for response** before any public disclosure
   - use fallback contact methods (below) if no response within 48hrs.
     
### 📧 What to Include

Please provide:
- **Vulnerability type** (e.g., buffer overflow, injection, etc.)
- **Affected components** (frontend, backend, FFI, etc.)
- **Severity assessment** (Critical, High, Medium, Low)
- **Proof of concept** (if applicable)
- **Environment details** (OS, versions, etc.)

### ⏱️ Response Timeline

- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Resolution**: Within 30 days (depending on severity)

### 🏆 Reward / Recognition

Vulnerability reports are taken seriously. If your report is indeed found to be essential to security- you will be compensated accordingly based on severity of reported issue & the quality of your disclosure, reward amounts are based in XFG and paid using resources from Fuego's Development treasury.
We greatly appreciate security researchers helping to improve Fuego network & wallet security. 
Contributors are:
- Listed in our security acknowledgments
- Invited to our security researcher program
- Recognized in release notes (with permission)

## 🔐 Security Features

### Encryption
- **AES-256** encryption for wallet data
- **TLS 1.3** for network communication
- **Secure key derivation** using PBKDF2/Argon2
- **Encrypted backups** with ZIP encryption

### Authentication
- **Session management** with secure tokens
- **Password strength validation**
- **Multi-factor authentication** support
- **Secure session timeouts**

### Input Validation
- **Comprehensive input sanitization**
- **SQL injection prevention**
- **XSS protection**
- **Buffer overflow protection**

### Network Security
- **HTTPS-only** communication
- **Certificate pinning**
- **Secure random number generation**
- **Network request validation**

## 🛡️ Security Best Practices

### For Users
- **Use strong passwords** (12+ characters, mixed case, numbers, symbols)
- **Enable auto-backup** for wallet data
- **Keep software updated** to latest versions
- **Verify downloads** using checksums
- **Use secure networks** (avoid public WiFi)
- **Use 2FA** (device-based) when available
- **AVOID using Email or online account-based 2FA** when possible

### For Developers
- **Follow secure coding practices**
- **Validate all inputs**
- **Use parameterized queries**
- **Implement proper error handling**
- **Keep dependencies updated**
- **Follow OWASP guidelines**

## 🔍 Security Audits

### Regular Audits
- **Automated security scanning** in CI/CD
- **Dependency vulnerability checks**
- **Code quality analysis**
- **Penetration testing** (quarterly)

### External Audits
- **Third-party security reviews**
- **Community security assessments**
- **Bug bounty programs**
- **Professional security consulting**

## 📋 Security Checklist

### Development
- [ ] Input validation implemented
- [ ] Output encoding applied
- [ ] Authentication required
- [ ] Authorization checked
- [ ] Error handling secure
- [ ] Logging implemented
- [ ] Dependencies updated

### Deployment
- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Access controls implemented
- [ ] Monitoring enabled
- [ ] Backup procedures tested
- [ ] Incident response plan ready

## 🚨 Incident Response

### Security Incident Process
1. **Detection** - Monitor logs and alerts
2. **Assessment** - Evaluate severity and impact
3. **Containment** - Isolate affected systems
4. **Investigation** - Determine root cause
5. **Recovery** - Restore normal operations
6. **Lessons Learned** - Improve security measures

### Contact Information 
- **Security Team**: [fuegosecurity@proton.me](mailto:fuegosecurity@proton.me)
- **Emergency Email Contact**: ? [founder/dev](mailto:aejt@pm.me)
- **Simplex**: Additional emergency [contact](https://simplex.chat/invitation#/?v=2-7&smp=smp%3A%2F%2F0YuTwO05YJWS8rkjn9eLJDjQhFKvIYd8d4xG8X1blIU%3D%40smp8.simplex.im%2F1ZUOmPKsP23oG2n4WyYnLnJN8OESqPWT%23%2F%3Fv%3D1-4%26dh%3DMCowBQYDK2VuAyEAR92wBfR8cLpH8VizZ3NenC8wtvMJ2SeP3BkMuBuQ7kQ%253D%26q%3Dm%26k%3Ds%26srv%3Dbeccx4yfxxbvyhqypaavemqurytl6hozr47wfc7uuecacjqdvwpw2xid.onion&e2e=v%3D2-3%26x3dh%3DMEIwBQYDK2VvAzkAQc2AmjUeraIn9N0ggXF5L5hkWYRUyOYEP1NtdSaWnu9Eu5xrA4Aa1io6s4668B9nFVoRtHTHsO0%3D%2CMEIwBQYDK2VvAzkAqvm69F0rIcnxeDWrl2aRIUO-8OwAwidnqIJqxaibVJB66wGe_S0iRzeHLATg7u79FOuLv_nBvTA%3D)
- **For General Support**: please use [XFG🔥discord](https://discord.usexfg.org)

## 📚 Security Resources

### Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [Rust Security Guidelines](https://doc.rust-lang.org/book/ch19-01-unsafe-rust.html)

### Tools
- **Rust**: `cargo audit` for dependency vulnerabilities
- **Node.js**: `npm audit` for package vulnerabilities
- **Trivy**: Container and filesystem vulnerability scanner
- **CodeQL**: Static analysis for security vulnerabilities

## 🔄 Security Updates

### Update Process
1. **Vulnerability assessment**
2. **Patch development**
3. **Testing and validation**
4. **Release coordination**
5. **User notification**
6. **Post-release monitoring**

### Notification Methods
- **GitHub Security Reviews**
- **Release notes**
- **Email notifications** (for critical issues)
- **In-app notifications**

## 📇 𝌕 Contact

For all security-related issues or concerns:

- **Email**: [fuegosecurity@protonmail](mailto:fuegosecurity@proton.me)
- **Simplex**: Additional [contact](https://simplex.chat/invitation#/?v=2-7&smp=smp%3A%2F%2F0YuTwO05YJWS8rkjn9eLJDjQhFKvIYd8d4xG8X1blIU%3D%40smp8.simplex.im%2F1ZUOmPKsP23oG2n4WyYnLnJN8OESqPWT%23%2F%3Fv%3D1-4%26dh%3DMCowBQYDK2VuAyEAR92wBfR8cLpH8VizZ3NenC8wtvMJ2SeP3BkMuBuQ7kQ%253D%26q%3Dm%26k%3Ds%26srv%3Dbeccx4yfxxbvyhqypaavemqurytl6hozr47wfc7uuecacjqdvwpw2xid.onion&e2e=v%3D2-3%26x3dh%3DMEIwBQYDK2VvAzkAQc2AmjUeraIn9N0ggXF5L5hkWYRUyOYEP1NtdSaWnu9Eu5xrA4Aa1io6s4668B9nFVoRtHTHsO0%3D%2CMEIwBQYDK2VvAzkAqvm69F0rIcnxeDWrl2aRIUO-8OwAwidnqIJqxaibVJB66wGe_S0iRzeHLATg7u79FOuLv_nBvTA%3D) option for private disclosure of any network security vulnerability.
- **General**: Join the Fuego Mob in [discord](https://discord.usexfg.org)
---

**Last Updated**: Sept 2025  
**Next Review**: March 2026
