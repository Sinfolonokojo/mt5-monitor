# Google Sheets Integration Setup Guide

This guide will help you set up Google Sheets integration to sync your MT5 account data.

## Prerequisites

- Google Account
- Google Cloud Project (or create a new one)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

## Step 2: Enable Google Sheets API

1. In Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Sheets API"
3. Click on it and click **Enable**
4. Also enable "Google Drive API" (required for file access)

## Step 3: Create Service Account

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in the details:
   - Service account name: `mt5-sheets-sync` (or your preferred name)
   - Service account ID: (auto-generated)
   - Description: "Service account for MT5 account data sync"
4. Click **Create and Continue**
5. Skip the optional "Grant this service account access to project" step
6. Click **Done**

## Step 4: Create Service Account Key

1. In the **Credentials** page, find your newly created service account
2. Click on it to open details
3. Go to the **Keys** tab
4. Click **Add Key** > **Create New Key**
5. Select **JSON** format
6. Click **Create**
7. A JSON file will be downloaded - **keep this file safe!**
8. Rename the file to `credentials.json`
9. Place it in your `main-backend` directory

## Step 5: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Give it a name (e.g., "MT5 Trading Accounts")
4. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
5. **Important:** Share the spreadsheet with your service account:
   - Click the **Share** button
   - Paste the service account email (from the JSON file, looks like: `mt5-sheets-sync@project-id.iam.gserviceaccount.com`)
   - Give it **Editor** permission
   - Click **Send**

## Step 6: Configure Backend Environment

Add these variables to your `main-backend/.env` file:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_WORKSHEET_NAME=MT5 Accounts
```

Replace `your_spreadsheet_id_here` with the ID you copied in Step 5.

## Step 7: Install Dependencies

```bash
cd main-backend
pip install -r requirements.txt
```

## Step 8: Test the Integration

1. Start your backend:
   ```bash
   uvicorn app.main:app --reload
   ```

2. Open your frontend dashboard
3. Click the **"Sync to Google Sheets"** button
4. You should see a success message with a link to your spreadsheet
5. Click the link to view your synced data in Google Sheets!

## What Gets Synced

The following data is synced to Google Sheets:

- Account Number
- Holder Name
- Prop Firm
- Phase (F1, F2, R)
- Connection Status
- Current Balance
- Initial Balance
- Profit/Loss (with color coding: green for profit, red for loss)
- P/L Percentage
- Max Loss Buffer
- Days Operating
- Open Position Status
- VS Group
- Last Updated Timestamp

## Features

- **Auto-formatting**: Headers are styled with dark background and white text
- **Color-coded P/L**: Green for profitable accounts, red for losses
- **Auto-resize columns**: Columns automatically adjust to content
- **Timestamp**: Each sync includes a timestamp at the bottom
- **Link in UI**: Success message includes a direct link to your spreadsheet

## Troubleshooting

### "Failed to authenticate with Google Sheets"
- Make sure `credentials.json` exists in the `main-backend` directory
- Verify the JSON file is valid (not corrupted during download)
- Check that the service account has the correct permissions

### "Permission denied" or "403 error"
- Make sure you shared the spreadsheet with your service account email
- The service account email is in the `credentials.json` file under `"client_email"`
- Grant **Editor** permission (not Viewer)

### "Spreadsheet not found"
- Verify the `GOOGLE_SHEETS_SPREADSHEET_ID` in your `.env` file
- Make sure the ID is correct (copy from the URL)
- Ensure the spreadsheet exists and is accessible

### "Module not found: gspread"
- Run `pip install -r requirements.txt` in the `main-backend` directory
- Restart your backend server

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit `credentials.json` to git**
   - Already added to `.gitignore`
   - Keep this file secure and private

2. **Limit service account permissions**
   - Only share the specific spreadsheet with the service account
   - Don't give broader Google Drive access

3. **Rotate keys periodically**
   - Consider creating new service account keys every few months
   - Delete old keys from Google Cloud Console

## Advanced Configuration

### Multiple Worksheets

You can sync to different worksheets by changing:

```env
GOOGLE_SHEETS_WORKSHEET_NAME=Production
```

### Custom Formatting

Edit `main-backend/app/google_sheets_service.py` to customize:
- Column headers
- Color schemes
- Data formatting
- Additional calculated fields

## Support

If you encounter issues not covered here, check:
- [Google Sheets API Documentation](https://developers.google.com/sheets/api)
- [gspread Documentation](https://docs.gspread.org/)
