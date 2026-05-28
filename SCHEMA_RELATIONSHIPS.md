# Database Schema Relationships Overview

## Entity Relationship Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER (DONOR/CREATOR/ADMIN)                     │
├─────────────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                           │
│ UNIQUE: email, walletAddress                                            │
│ Fields: name, role, bio, isActive                                       │
│ Timestamps: createdAt, updatedAt                                        │
└─────────────────────────────────────────────────────────────────────────┘
    │
    │ creates (1:N)          │ makes (1:N)          │ posts (1:N)
    │                        │                      │
    ▼                        ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   CAMPAIGN       │  │    DONATION      │  │     UPDATE       │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ PK: id (UUID)    │  │ PK: id (UUID)    │  │ PK: id (UUID)    │
│ FK: creatorId    │  │ FK: donorId      │  │ FK: campaignId   │
│ Status: ENUM(6)  │  │ FK: campaignId   │  │ FK: creatorId    │
│ goalAmount       │  │ Status: ENUM(4)  │  │ title, content   │
│ raisedAmount     │  │ txHash (UNIQUE)  │  │ imageUrl         │
│ category         │  │ assetCode        │  │                  │
└──────────────────┘  │ donatedAt        │  └──────────────────┘
    │                 │ confirmedAt      │
    │ (1:N)           └──────────────────┘
    ├─── Milestones        │
    │                      │ (1:N)
    ├─── Updates           └─── Disputes ◄──── USER (filer)
    │                              │
    └─── Disputes           FK: donationId (UNIQUE)
                            Status: ENUM(4)
                            reason, resolution

┌──────────────────────────────────────────────────────────────────────┐
│                      NOTIFICATION                                    │
├──────────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                        │
│ FK: userId                                                           │
│ type: ENUM(NotificationType)                                         │
│ title, message, relatedId                                            │
│ isRead (Boolean)                                                     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       NEWSLETTER                                     │
├──────────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                        │
│ FK: userId (UNIQUE)                                                  │
│ email (UNIQUE)                                                       │
│ isSubscribed, subscribedAt, unsubscribedAt                          │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        AUDITLOG                                      │
├──────────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                        │
│ FK: userId (NULLABLE)                                                │
│ action: ENUM(AuditActionType)                                        │
│ resourceType, resourceId                                             │
│ details (JSON), ipAddress, userAgent                                 │
│ createdAt (NO updatedAt - immutable)                                 │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                       MILESTONE                                      │
├──────────────────────────────────────────────────────────────────────┤
│ PK: id (UUID)                                                        │
│ FK: campaignId                                                       │
│ title, description, targetAmount                                     │
│ status: ENUM(MilestoneStatus)                                        │
│ dueDate, completedAt                                                 │
└──────────────────────────────────────────────────────────────────────┘
```

## Relationship Summary

| From | To | Type | Foreign Key | Delete Rule |
|------|-----|------|-------------|------------|
| User | Campaign | 1:N | creatorId | CASCADE |
| User | Donation | 1:N | donorId | CASCADE |
| User | Update | 1:N | creatorId | CASCADE |
| User | Notification | 1:N | userId | CASCADE |
| User | Dispute | 1:N | filerId | CASCADE |
| User | Newsletter | 1:1 | userId | CASCADE |
| User | AuditLog | 1:N | userId | SET NULL |
| Campaign | Donation | 1:N | campaignId | CASCADE |
| Campaign | Milestone | 1:N | campaignId | CASCADE |
| Campaign | Update | 1:N | campaignId | CASCADE |
| Campaign | Dispute | 1:N | campaignId | CASCADE |
| Donation | Dispute | 1:1 | donationId | CASCADE |

## Cascade Delete Behavior

When a parent record is deleted, child records are automatically deleted:

```
DELETE User → Cascades to:
  ├── All Campaigns created by user
  ├── All Donations made by user
  ├── All Updates posted by user
  ├── All Notifications for user
  ├── All Disputes filed by user
  └── Newsletter subscription (if exists)

DELETE Campaign → Cascades to:
  ├── All Donations to campaign
  ├── All Milestones for campaign
  ├── All Updates for campaign
  └── All Disputes related to campaign

DELETE Donation → Cascades to:
  └── Dispute (if exists)
```

**Special Case**: AuditLog uses `SET NULL` for userId, preserving audit history even after user deletion.

## Key Design Decisions

1. **Campaign instead of Project**: Renamed from "Project" to "Campaign" for domain clarity
2. **Decimal Precision**: `Decimal(20, 7)` for financial amounts to support 13 integer digits + 7 decimals
3. **Cascade Deletes**: Ensures data consistency and prevents orphaned records
4. **Optional AuditLog.userId**: Allows audit trail to survive user deletion
5. **Composite Unique on Donation**: Prevents duplicate donations from same donor to same campaign
6. **Newsletter 1:1 with User**: Only one subscription per user
7. **Dispute 1:1 with Donation**: Only one active dispute per donation
8. **Status Enums**: Enforce valid state transitions at database level
9. **Strategic Indices**: 30+ indices on foreign keys and frequently queried fields
10. **Timestamps on All Models**: Enable audit trails and chronological queries

## Enums Reference

### UserRole (3 values)
```
DONOR      - Makes donations
CREATOR    - Creates campaigns
ADMIN      - System administrator
```

### CampaignStatus (6 values)
```
DRAFT              - Draft, not submitted
PENDING_APPROVAL   - Under admin review
ACTIVE             - Approved, fundraising
COMPLETED          - Goal reached or deadline passed
CANCELLED          - Creator cancelled
REJECTED           - Admin rejected
```

### DonationStatus (4 values)
```
PENDING    - Awaiting blockchain confirmation
CONFIRMED  - Blockchain confirmed
REFUNDED   - Refund processed
FAILED     - Transaction failed
```

### MilestoneStatus (4 values)
```
PENDING    - Not yet started
ACTIVE     - Currently in progress
COMPLETED  - Goals achieved
FAILED     - Target not reached
```

### NotificationType (7 values)
```
CAMPAIGN_CREATED    - New campaign
CAMPAIGN_UPDATED    - Campaign details changed
DONATION_RECEIVED   - Donation received
MILESTONE_REACHED   - Milestone achieved
CAMPAIGN_COMPLETED  - Campaign finished
DISPUTE_FILED       - Dispute opened
DISPUTE_RESOLVED    - Dispute settled
```

### DisputeStatus (4 values)
```
OPENED      - Freshly filed
UNDER_REVIEW - Admin reviewing
RESOLVED    - Resolved
REJECTED    - Invalid/rejected
```

### AuditActionType (7 values)
```
USER_CREATED       - User registered
CAMPAIGN_CREATED   - Campaign created
CAMPAIGN_UPDATED   - Campaign modified
DONATION_MADE      - Donation recorded
MILESTONE_COMPLETED - Milestone achieved
DISPUTE_FILED      - Dispute opened
ADMIN_ACTION       - Admin action
```

## Validation Rules Enforced at Database Level

1. **Unique Emails**: One account per email
2. **Unique Wallet Addresses**: One wallet per user
3. **Unique Transaction Hashes**: One entry per blockchain transaction
4. **Unique Dispute per Donation**: One dispute per donation
5. **Unique Newsletter per User**: One subscription per user
6. **Unique Newsletter per Email**: Cannot subscribe same email twice
7. **Composite Unique**: Donation (donorId, campaignId, txHash)

## Indices for Performance

### Foreign Key Indices (Auto)
- User.role
- Campaign.creatorId, Campaign.status, Campaign.category, Campaign.createdAt
- Donation.donorId, Donation.campaignId, Donation.status, Donation.createdAt
- Milestone.campaignId, Milestone.status
- Update.campaignId, Update.creatorId, Update.createdAt
- Notification.userId, Notification.isRead, Notification.createdAt
- Dispute.filerId, Dispute.campaignId, Dispute.status, Dispute.createdAt
- Newsletter.email, Newsletter.isSubscribed
- AuditLog.userId, AuditLog.action, AuditLog.resourceType, AuditLog.createdAt

### Search Optimizations
```sql
-- Find campaigns by creator
SELECT * FROM campaigns WHERE "creatorId" = ? ORDER BY "createdAt" DESC;

-- Find active campaigns
SELECT * FROM campaigns WHERE status = 'ACTIVE' ORDER BY "createdAt" DESC;

-- Find donations to campaign
SELECT * FROM donations WHERE "campaignId" = ? ORDER BY "createdAt" DESC;

-- Find user's donations
SELECT * FROM donations WHERE "donorId" = ? ORDER BY "createdAt" DESC;

-- Find unread notifications
SELECT * FROM notifications WHERE "userId" = ? AND "isRead" = false;

-- Find audit trail
SELECT * FROM audit_logs WHERE "userId" = ? ORDER BY "createdAt" DESC;
```

