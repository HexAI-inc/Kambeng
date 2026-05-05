# QR Code Generation Feature

## Overview
This feature allows campaigns to generate and share QR codes that link to different parts of the campaign (campaign page, donation page, short codes).

## Backend Implementation

### QR Code Service (`app/services/qrcode_service.py`)
- **QRCodeService class**: Central service for generating QR codes
- Methods:
  - `generate_campaign_qr_code(campaign_slug)` - QR for campaign details page
  - `generate_donation_qr_code(campaign_slug)` - QR for donation page
  - `generate_short_code_qr(short_code)` - QR for short URL alias
  - `_generate_qr_code_bytes(data)` - Internal method to generate PNG bytes

### Endpoints (`app/api/routes/utils.py`)

#### 1. Campaign QR Code (PNG)
```
GET /api/utils/qrcode/campaign/{slug}
```
Returns PNG image that links to campaign details page.

#### 2. Campaign QR Code Base64
```
GET /api/utils/qrcode/campaign/{slug}/base64
```
Returns JSON with base64-encoded QR code for inline display:
```json
{
  "campaign_slug": "my-campaign",
  "qr_code_base64": "data:image/png;base64,...",
  "qr_code_url": "http://...../qrcode/campaign/my-campaign"
}
```

#### 3. Donation QR Code (PNG)
```
GET /api/utils/qrcode/donation/{slug}
```
Returns PNG image that links to quick-donate page.

#### 4. Short Code QR Code (PNG)
```
GET /api/utils/qrcode/short/{short_code}
```
Returns PNG image that links to short code alias.

## Frontend Implementation

### React Hooks (`src/hooks/use-frontend-data.ts`)
- `useCampaignQRCode(slug, enabled)` - Fetch campaign QR as base64
- `useDonationQRCode(slug, enabled)` - Fetch donation QR as blob
- `useShortCodeQRCode(shortCode, enabled)` - Fetch short code QR as blob

### Components

#### 1. QRCodeDisplay (`src/components/qr-code-display.tsx`)
Reusable component to display a single QR code with download and share options:
```tsx
<QRCodeDisplay
  qrDataUrl={qrDataUrl}
  title="Campaign QR Code"
  campaignSlug="my-campaign"
  downloadFilename="campaign-qr.png"
/>
```

#### 2. QRCodeGrid
Display multiple QR codes in a grid layout:
```tsx
<QRCodeGrid
  campaignQR={campaignQRData}
  donationQR={donationQRData}
  shortCodeQR={shortCodeQRData}
  campaignSlug="my-campaign"
/>
```

#### 3. CampaignQRModal (`src/components/campaign-qr-modal.tsx`)
Modal popup for displaying QR codes on campaign pages:
```tsx
<CampaignQRModal
  campaignSlug="my-campaign"
  campaignTitle="My Awesome Campaign"
/>
```

### Pages

#### 1. Campaign QR Codes Dashboard (`/dashboard/my-campaigns/[campaignId]/qr-codes`)
Full dashboard for managing and sharing campaign QR codes:
- View all QR code types
- Download individual QR codes
- Copy campaign links
- Tips for using QR codes
- Format information

## Usage Examples

### Backend Test
```bash
# Get campaign QR code as PNG
curl http://localhost:8001/api/utils/qrcode/campaign/my-campaign-slug

# Get campaign QR code as base64 JSON
curl http://localhost:8001/api/utils/qrcode/campaign/my-campaign-slug/base64
```

### Frontend
```tsx
import { useCampaignQRCode } from '@/hooks/use-frontend-data';
import { QRCodeDisplay } from '@/components/qr-code-display';

function MyCampaign() {
  const qrCode = useCampaignQRCode('my-campaign-slug');
  
  return (
    <QRCodeDisplay
      qrDataUrl={qrCode.data?.qr_code_base64}
      title="Campaign QR Code"
      isLoading={qrCode.isLoading}
    />
  );
}
```

## Features

### QR Code Generation
- High error correction (ERROR_CORRECT_H) for better scanning reliability
- Automatic sizing to fit content
- PNG format for wide compatibility
- 10x10 pixel boxes with 2-box border

### Downloads
- Download QR codes as PNG files
- Copy campaign links to clipboard
- Share directly on social media

### Sharing Options
- **Campaign Page QR**: Links to full campaign details
- **Donation QR**: Skips campaign details, goes straight to donation
- **Short Code QR**: Compact alias for easier manual typing

## URL Mapping

When QR codes are scanned, they redirect to:

1. **Campaign Page QR**:
   - Encodes: `http://localhost:8001/campaigns/{slug}`
   - Frontend route: `/campaigns/{slug}`

2. **Donation QR**:
   - Encodes: `http://localhost:8001/quick-pay/{slug}`
   - Frontend route: `/quick-pay/{slug}`

3. **Short Code QR**:
   - Encodes: `http://localhost:8001/c/{short_code}`
   - Frontend route: `/c/{short_code}` (needs alias redirect endpoint)

## Future Enhancements

- [ ] Add QR code analytics tracking (which QR codes get scanned)
- [ ] Custom QR code styling (logo, colors, branding)
- [ ] Bulk QR code generation for multiple campaigns
- [ ] QR code expiry/rotation for security
- [ ] Dynamic QR codes that redirect through tracking service
- [ ] QR code templates (pre-made designs with QR embedded)
