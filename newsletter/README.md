# Poteau Newsletter System

Send branded newsletters to users via AWS SES.

## Setup (One-time)

### 1. Upload Template to AWS SES

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
node createTemplate.js
```

### 2. Create Configuration Set in AWS Console

1. Go to AWS SES Console > Configuration Sets
2. Create new: `newsletter-emails`
3. Add Event Destination:
   - Events: Open, Click, Bounce, Complaint
   - Destination: SNS Topic (create new: `newsletter-events`)
4. Subscribe the Cloud Function to the SNS topic:
   - Protocol: HTTPS
   - Endpoint: `https://us-central1-krank-club.cloudfunctions.net/processNewsletterEvents`

### 3. Deploy Cloud Function

```bash
cd ~/poteau-workspace/cloud-functions/functions
firebase deploy --only functions:processNewsletterEvents
```

## Sending a Newsletter

### 1. Create Campaign JSON

Create `campaigns/my-campaign.json`:

```json
{
    "id": "my-campaign",
    "subject": {
        "fr": "Sujet en francais",
        "en": "Subject in English",
        "es": "Asunto en espanol",
        "it": "Oggetto in italiano"
    },
    "headline": { ... },
    "body_text": { ... },
    "cta_text": { ... },
    "cta_url": "https://poteau.app/...",
    "learn_more_url": "https://notion.so/...",
    ...
}
```

See `campaigns/example.json` for full structure.

### 2. Test Send

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
node sendNewsletter.js my-campaign --test
```

This sends to 4 test emails only. Check your inbox.

### 3. Production Send

```bash
node sendNewsletter.js my-campaign --send
```

5-second countdown before sending to all users.

### 4. Check Stats

```bash
node getStats.js my-campaign
```

## File Structure

```
newsletter/
├── createTemplate.js      # Upload template to SES (run once)
├── sendNewsletter.js      # Send newsletters
├── getStats.js            # View open/click rates
├── templates/
│   └── newsletter.html    # HTML email template
└── campaigns/
    └── example.json       # Example campaign
```

## Template Variables

| Variable | Description |
|----------|-------------|
| `{{subject}}` | Email subject line |
| `{{preview_text}}` | Preview text (shown in inbox) |
| `{{headline}}` | Main headline (Bakbak One font) |
| `{{body_text}}` | Body text |
| `{{cta_text}}` | Button text |
| `{{cta_url}}` | Button URL |
| `{{learn_more_url}}` | Optional "Learn more" link |
| `{{learn_more_text}}` | "Learn more" text |
| `{{footer_text}}` | Footer (e.g., "L'equipe Poteau") |
| `{{unsubscribe_url}}` | Auto-generated unsubscribe link |
| `{{unsubscribe_text}}` | Unsubscribe text |

## Rate Limits

- AWS SES: 14 emails/second (script does 10/second)
- No rate limiting between campaigns (users can receive multiple newsletters)
