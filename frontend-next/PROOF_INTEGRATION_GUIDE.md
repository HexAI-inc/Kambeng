# Proof Upload & Display - Integration Guide

## Components Created

### 1. ProofUploadForm
**Location**: `src/components/ProofUploadForm.tsx`

**Usage in Dashboard**:
```tsx
import { ProofUploadForm } from "@/components/ProofUploadForm";

export default function MyDashboardPage() {
  const { slug } = useParams();
  
  return (
    <div>
      <ProofUploadForm 
        slug={slug as string}
        onSuccess={() => {
          // Refetch proofs or show success message
        }}
      />
    </div>
  );
}
```

### 2. ProofList
**Location**: `src/components/ProofList.tsx`

**Usage on Campaign Page**:
```tsx
import { useCampaignProofs } from "@/hooks/use-frontend-data";
import { ProofList } from "@/components/ProofList";

export default function CampaignPage() {
  const { data: proofs } = useCampaignProofs(slug);
  const { data: profile } = useSessionProfile();
  
  const isDonor = /* check if user is donor to this campaign */;
  const isOwner = profile?.id === campaign?.user_id;
  
  return (
    <ProofList 
      proofs={proofs || []}
      userRole={profile?.role}
      isDonor={isDonor}
      isOwner={isOwner}
    />
  );
}
```

## Form Fields

### ProofUploadForm sends:
- `file`: Binary file (PNG, JPEG, PDF, max 50MB)
- `document_type`: One of STUDENT_ID, UTG_PORTAL, TRANSCRIPT, TUITION_RECEIPT, OTHER
- `visibility`: One of ADMIN_ONLY, DONOR_ONLY, PUBLIC
- `description`: Optional text up to 500 chars

### Backend Endpoint
- **POST** `/uploads/proofs/{slug}`
- Requires authentication
- Multipart form data
- Returns: `Proof` object

## Privacy Gating Logic

The backend applies visibility filtering automatically on GET `/uploads/proofs/{slug}`:

1. **Campaign Owner + Admin**: See ALL proofs
2. **Donors**: See PUBLIC + DONOR_ONLY proofs (checked via Donation table)
3. **Public Users**: See only PUBLIC proofs

Frontend does NOT need to filter; backend handles it. Just display what the API returns.

## Integration Checklist

- [ ] Import ProofUploadForm in campaign dashboard page
- [ ] Import ProofList in campaign detail page (public)
- [ ] Add proof section to campaign dashboard (after images section)
- [ ] Add proof evidence section to campaign public page
- [ ] Test upload with different visibility levels
- [ ] Test donor-only visibility (as a donor user)
- [ ] Test public visibility
- [ ] Verify privacy gating works

## Future Features (Deferred)

1. **Donor Inbox/Comments** - Two-way communication via comments section
2. **Receipt Milestone Badges** - Auto/manual approval tied to goals feature
3. **Proof Metadata** - Edit description, change visibility after upload
