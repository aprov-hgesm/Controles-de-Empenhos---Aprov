# Security Specification: Hospital Logistics Firebase Integration

## 1. Data Invariants

1. **Authentication Boundary**: Every document created must contain a `userId` field which strictly matches the current authenticated user's UID (`request.auth.uid`).
2. **Owner Isolation**: Users can only read, write, update, or delete their own documents. There are no shared reads/writes across user accounts to prevent corporate/PII leaks.
3. **Email Verification**: All writes require the user to have a verified email address (`request.auth.token.email_verified == true`).
4. **Id Validation**: Document path keys and document ID fields must be valid identifier strings (e.g., matching standard regex `^[a-zA-Z0-9_\-]+$`) and under 128 characters.
5. **Immutability of Identity**: The `userId` field can never be altered after document creation.
6. **Immutable Key Properties**: Key timestamps and core relationships (like `empenhoId` inside an invoice) are immutable.
7. **Type and Size Constraints**: All text fields are strictly constrained in length (e.g., IDs under 128 chars, descriptions under 500 chars) to defend against Denial of Wallet (DoW) attacks.

---

## 2. The "Dirty Dozen" Malicious Payloads

Here are 12 specific payloads or operations designed to breach the system's laws of Identity, Integrity, and State, which the security rules must reject.

### 1. Identity Spoofing (Create Empenho)
* **Goal**: Write an empenho under another user's `userId`.
* **Payload**:
  ```json
  {
    "id": "2026NE999",
    "supplier": "Distribuidora Maliciosa",
    "description": "Tentativa de injeção de empenho",
    "date": "30/06/2026",
    "status": "Ativo",
    "items": [],
    "userId": "other-victim-user-123"
  }
  ```

### 2. Identity Spoofing (Update Empenho)
* **Goal**: Claim ownership of an existing empenho by changing `userId`.
* **Payload (diff)**:
  ```json
  {
    "userId": "my-attacker-uid-456"
  }
  ```

### 3. Unauthenticated Write
* **Goal**: Write to `/empenhos/test` without a valid Firebase Auth token.
* **Payload**: Standard valid schema payload but missing `request.auth` credentials.

### 4. Unverified Email Bypass
* **Goal**: Perform a write operation with an unverified email account (`email_verified = false`).
* **Payload**: Standard valid schema payload under user's own `userId`, but `request.auth.token.email_verified == false`.

### 5. Cross-User Data Reading (Leaking PII)
* **Goal**: Retrieve the empenhos list or individual document belonging to `other-victim-user-123`.
* **Operation**: `get` or `list` on `/empenhos/victim-empenho-id` when `resource.data.userId == "other-victim-user-123"`.

### 6. Unauthorized Delete
* **Goal**: Delete an invoice belonging to another user.
* **Operation**: `delete` on `/invoices/victim-invoice-id` when `resource.data.userId == "other-victim-user-123"`.

### 7. Value Poisoning (Invalid Status)
* **Goal**: Poison the `status` field of an empenho with an invalid value.
* **Payload**:
  ```json
  {
    "status": "SUPER_URGENTE_INVALIDO_STATUS"
  }
  ```

### 8. Denial of Wallet (Resource Exhaustion)
* **Goal**: Store a massive string (e.g. 500KB) into the `description` or `pregao` field.
* **Payload**:
  ```json
  {
    "pregao": "A" * 100000
  }
  ```

### 9. Temporal Integrity/Immutability Violation
* **Goal**: Change the `issueDate` of a registered invoice after creation.
* **Payload (diff)**:
  ```json
  {
    "issueDate": "2020-01-01"
  }
  ```

### 10. Self-Assigned Role or Privilege Escalation
* **Goal**: Spoofing user fields to act as administrative or override other constraints.
* **Payload**: Injecting arbitrary extra fields like `role: "admin"` or `isAdmin: true` into a document that the rules don't strictly ignore or block.

### 11. Sibling Orphan Creation
* **Goal**: Create an invoice referencing a non-existent or inaccessible empenho.
* **Operation**: Creating `/invoices/malicious-invoice` with `empenhoId` set to a dummy non-existent ID.

### 12. State Corruption (Negative Values)
* **Goal**: Inject negative quantities or prices.
* **Payload**:
  ```json
  {
    "totalValue": -50000.00
  }
  ```

---

## 3. The Test Runner Spec (`firestore.rules.test.ts`)

Below is the structure of the verification suite that secures these policies:

```typescript
// firestore.rules.test.ts
// Verifies that all "Dirty Dozen" malicious payloads return PERMISSION_DENIED.
// Tested using the Firebase Local Emulator or local rule validation.
```
