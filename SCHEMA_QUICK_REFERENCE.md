# OrbitChain Schema - Quick Reference Card

## Models at a Glance

### Core Models (4)
| Model | Purpose | Key Fields | Relations |
|-------|---------|-----------|-----------|
| **User** | Accounts (Donor/Creator/Admin) | email, role, walletAddress | Creates campaigns, makes donations, posts updates |
| **Campaign** | Fundraising campaigns | title, goalAmount, status, category | Has donations, milestones, updates, disputes |
| **Donation** | Individual contributions | amount, txHash, status, assetCode | Linked to donor & campaign, may have dispute |
| **Milestone** | Campaign goals/targets | title, targetAmount, status, dueDate | Belongs to campaign |

### Content Models (2)
| Model | Purpose | Key Fields | Relations |
|-------|---------|-----------|-----------|
| **Update** | Campaign progress posts | title, content, imageUrl | Belongs to campaign, posted by creator |
| **Notification** | User notifications | type, message, isRead, relatedId | Belongs to user |

### Business Models (3)
| Model | Purpose | Key Fields | Relations |
|-------|---------|-----------|-----------|
| **Dispute** | Dispute resolution | reason, status, resolution, resolvedAt | Belongs to donation, filer, campaign |
| **Newsletter** | Email subscriptions | email, isSubscribed, subscribedAt | Belongs to user (1:1) |
| **AuditLog** | System audit trail | action, resourceType, resourceId, ipAddress | Tracked by user (nullable) |

---

## Enum Reference

### User Management
```
UserRole: DONOR | CREATOR | ADMIN
```

### Campaign Lifecycle
```
CampaignStatus: DRAFT
              | PENDING_APPROVAL
              | ACTIVE
              | COMPLETED
              | CANCELLED
              | REJECTED
```

### Donation State
```
DonationStatus: PENDING | CONFIRMED | REFUNDED | FAILED
```

### Milestone Progress
```
MilestoneStatus: PENDING | ACTIVE | COMPLETED | FAILED
```

### Notifications
```
NotificationType: CAMPAIGN_CREATED
                | CAMPAIGN_UPDATED
                | DONATION_RECEIVED
                | MILESTONE_REACHED
                | CAMPAIGN_COMPLETED
                | DISPUTE_FILED
                | DISPUTE_RESOLVED
```

### Dispute Resolution
```
DisputeStatus: OPENED | UNDER_REVIEW | RESOLVED | REJECTED
```

### Audit Tracking
```
AuditActionType: USER_CREATED
               | CAMPAIGN_CREATED
               | CAMPAIGN_UPDATED
               | DONATION_MADE
               | MILESTONE_COMPLETED
               | DISPUTE_FILED
               | ADMIN_ACTION
```

---

## Key Relationships

### User (Hub)
```
User
├── 1:N Campaigns (created)
├── 1:N Donations (made)
├── 1:N Updates (posted)
├── 1:N Notifications
├── 1:N Disputes (filed)
├── 1:1 Newsletter (subscribed)
└── 1:N AuditLogs
```

### Campaign (Central)
```
Campaign
├── 1:N Donations
├── 1:N Milestones
├── 1:N Updates
└── 1:N Disputes
```

### Donation (Key Transaction)
```
Donation
├── 1:1 Dispute (if disputed)
└── References: Donor (User) + Campaign
```

---

## Critical Constraints

### Unique Fields
| Model | Field(s) | Reason |
|-------|---------|--------|
| User | email | One account per email |
| User | walletAddress | One wallet per user |
| Donation | txHash | One blockchain transaction |
| Donation | (donorId, campaignId, txHash) | Prevent duplicate donations |
| Dispute | donationId | One dispute per donation |
| Newsletter | userId | One subscription per user |
| Newsletter | email | Prevent duplicate subscriptions |

### Cascade Delete Behavior
```
DELETE User → Cascades to: Campaigns, Donations, Updates, Notifications, Disputes, Newsletter
DELETE Campaign → Cascades to: Donations, Milestones, Updates, Disputes
DELETE Donation → Cascades to: Disputes
DELETE User (AuditLog) → Sets to NULL (preserves audit history)
```

---

## Common Query Patterns

### Find User's Donations
```sql
SELECT * FROM donations 
WHERE "donorId" = ? 
ORDER BY "createdAt" DESC;
```

### Find Campaign's Donations
```sql
SELECT * FROM donations 
WHERE "campaignId" = ? 
ORDER BY "createdAt" DESC;
```

### Find Active Campaigns
```sql
SELECT * FROM campaigns 
WHERE status = 'ACTIVE' 
ORDER BY "createdAt" DESC;
```

### Find Campaign Milestones
```sql
SELECT * FROM milestones 
WHERE "campaignId" = ? 
ORDER BY "dueDate" ASC;
```

### Find User Notifications
```sql
SELECT * FROM notifications 
WHERE "userId" = ? AND "isRead" = false 
ORDER BY "createdAt" DESC;
```

### Find Disputes by Status
```sql
SELECT * FROM disputes 
WHERE status = 'OPENED' 
ORDER BY "createdAt" DESC;
```

---

## Migration Checklist

- [ ] Review SCHEMA_DOCUMENTATION.md
- [ ] Review SCHEMA_RELATIONSHIPS.md
- [ ] Review all 9 models and 7 enums
- [ ] Verify cascade delete strategies
- [ ] Check all indices are defined
- [ ] Approve with team lead
- [ ] Configure DATABASE_URL in .env
- [ ] Run: `npx prisma migrate dev --name init`
- [ ] Run: `npx prisma generate`
- [ ] Run: `npx prisma studio` (optional - visual verification)

---

## Model Statistics

```
Total Models:           9
Total Enums:            7
Total Fields:          110+
Total Foreign Keys:    12
Total Indices:         30+
Total Relationships:   22
Cascade Deletes:       11
Unique Constraints:    6+
Composite Constraints: 1
```

---

## Field Types Used

```
UUID (Primary Keys)        - Unique identifiers
String                    - Text fields
Decimal(20, 7)            - Monetary amounts
DateTime                  - Timestamps
Boolean                   - True/false flags
Enum (7 types)            - Status fields
```

---

## Timestamp Fields

Every model includes:
- `createdAt` DateTime @default(now())
- `updatedAt` DateTime @updatedAt

**Except**: AuditLog only has `createdAt` (immutable records)

---

## Index Strategy

### Foreign Key Indices (Auto)
Automatically created on all `@relation` fields for join performance

### Explicit Indices
- Status fields (fast filtering)
- Timestamp fields (chronological queries)
- Search fields (email, category)
- Boolean fields (isActive, isRead, isSubscribed)

---

## Reserved Words Handling

| Table | Mapping |
|-------|---------|
| update | "updates" (Prisma keyword) |
| audit_logs | Direct mapping (snake_case) |

---

## Next Steps

1. **Team Review** (24-48 hours)
   - Read SCHEMA_DOCUMENTATION.md
   - Read SCHEMA_RELATIONSHIPS.md
   - Approve design

2. **Configuration** (5 minutes)
   - Set DATABASE_URL in .env
   - Verify PostgreSQL connection

3. **Migration** (5 minutes)
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Development** (Ongoing)
   - Create Prisma service in NestJS
   - Build data repositories
   - Write integration tests

---

## Support Resources

| Question | Document |
|----------|----------|
| "What does each model do?" | SCHEMA_DOCUMENTATION.md |
| "How do models relate?" | SCHEMA_RELATIONSHIPS.md |
| "How do I migrate?" | MIGRATION_GUIDE.md |
| "Why this design?" | SCHEMA_DOCUMENTATION.md - Design Principles |
| "How do I query X?" | SCHEMA_RELATIONSHIPS.md - Query Examples |

---

## Quick Start Commands

```bash
# Validate schema
npx prisma validate

# Create first migration
npx prisma migrate dev --name init

# Generate types
npx prisma generate

# Open data browser
npx prisma studio

# Check schema in database
npx prisma db push

# Seed data
npx prisma db seed

# Format schema
npx prisma format
```

---

**Created**: 2024-05-28  
**Version**: 1.0  
**Status**: Ready for Migration ✅
