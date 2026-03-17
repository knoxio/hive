# CH-023: SSO/Enterprise RBAC

**As an** enterprise administrator, **I want to** configure Single Sign-On and role-based access control, **so that** users authenticate through our identity provider and permissions are managed centrally.

**Complexity:** XL
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Authentication system (user accounts, token management)
- Authorization middleware
- User registry

## Acceptance Criteria
- [ ] SAML 2.0 SSO integration: users authenticate via an external IdP (Okta, Azure AD, Google Workspace)
- [ ] OIDC (OpenID Connect) support as an alternative to SAML
- [ ] SSO configuration via admin UI: IdP metadata URL, entity ID, certificate, attribute mapping
- [ ] Just-in-time provisioning: first SSO login auto-creates a Hive user account
- [ ] RBAC roles: Owner, Admin, Member, Viewer, with distinct permission sets
- [ ] Permissions matrix: room create/delete, agent spawn/stop, plugin install, billing view, audit log view
- [ ] Custom roles: admin can create roles with specific permission combinations
- [ ] Role assignment via admin UI and API (per user, per workspace)
- [ ] Permission checks enforced at the API layer (middleware) for every endpoint
- [ ] Session management: SSO sessions expire according to IdP policy; Hive sessions expire after configurable idle timeout
- [ ] Forced logout: admin can terminate any user's session
- [ ] Group mapping: IdP groups map to Hive roles (e.g., "engineering" group -> "Member" role)
- [ ] REST API: `GET/PUT /api/auth/sso-config`, `GET/POST /api/roles`, `PUT /api/users/{id}/role`
- [ ] Unit tests cover permission checking for all RBAC roles against all protected endpoints
- [ ] Integration test: SSO login flow with a mock IdP produces a valid Hive session

## Technical Notes
- Use a mature SAML/OIDC library (e.g., `onelogin` crate or `openidconnect` crate for Rust)
- Permission checks should be middleware-based, not scattered in individual handlers
- Store roles and permissions in the user registry (extend the existing `users.json` schema)
- SSO metadata and certificates should be stored encrypted at rest
- Consider SCIM provisioning for automated user lifecycle management (future enhancement)
- Default roles (Owner, Admin, Member, Viewer) should be immutable; only custom roles are editable
