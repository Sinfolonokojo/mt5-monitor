import gspread
from google.oauth2.service_account import Credentials
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta
from .config import settings

class GoogleSheetsService:
    def __init__(self):
        self.credentials_file = settings.GOOGLE_SHEETS_CREDENTIALS_FILE
        self.spreadsheet_id = settings.GOOGLE_SHEETS_SPREADSHEET_ID
        self.worksheet_name = settings.GOOGLE_SHEETS_WORKSHEET_NAME
        self.client = None

    def authenticate(self):
        """Authenticate with Google Sheets API"""
        try:
            # Define the scope
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ]

            # Load credentials
            creds = Credentials.from_service_account_file(
                self.credentials_file,
                scopes=scopes
            )

            # Create client
            self.client = gspread.authorize(creds)
            return True
        except Exception as e:
            print(f"Error authenticating with Google Sheets: {e}")
            return False

    def get_or_create_worksheet(self):
        """Get or create the worksheet for MT5 accounts"""
        try:
            # Open the spreadsheet
            spreadsheet = self.client.open_by_key(self.spreadsheet_id)

            # Try to get the worksheet, create if it doesn't exist
            try:
                worksheet = spreadsheet.worksheet(self.worksheet_name)
            except gspread.exceptions.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(
                    title=self.worksheet_name,
                    rows=1000,
                    cols=20
                )

            return worksheet
        except Exception as e:
            print(f"Error getting/creating worksheet: {e}")
            raise

    def sync_accounts(self, accounts_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync account data to Google Sheets

        Args:
            accounts_data: Dictionary containing accounts list and metadata

        Returns:
            Dictionary with sync status and details
        """
        try:
            # Authenticate if not already done
            if not self.client:
                if not self.authenticate():
                    return {
                        "success": False,
                        "error": "Failed to authenticate with Google Sheets"
                    }

            # Get or create worksheet
            worksheet = self.get_or_create_worksheet()

            # Clear existing data
            worksheet.clear()

            # Prepare headers
            headers = [
                'Account Number',
                'Holder',
                'Prop Firm',
                'Balance',
                'P/L'
            ]

            # Prepare data rows
            accounts = accounts_data.get('accounts', [])

            # Sort accounts by balance in descending order (highest first)
            sorted_accounts = sorted(accounts, key=lambda x: x.get('balance', 0), reverse=True)

            rows = [headers]

            for account in sorted_accounts:
                initial_balance = account.get('initial_balance', 100000)
                balance = account.get('balance', 0)
                pl = balance - initial_balance

                row = [
                    str(account.get('account_number', '')),
                    account.get('account_holder', ''),
                    account.get('prop_firm', ''),
                    balance,
                    pl
                ]
                rows.append(row)

            # Update worksheet with all data at once
            worksheet.update('A1', rows)

            # Format the header row
            worksheet.format('A1:E1', {
                'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                'textFormat': {
                    'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                    'fontSize': 11,
                    'bold': True
                },
                'horizontalAlignment': 'CENTER'
            })

            # Format P/L column with colors
            for i, account in enumerate(sorted_accounts, start=2):
                initial_balance = account.get('initial_balance', 100000)
                balance = account.get('balance', 0)
                pl = balance - initial_balance

                # Color P/L cells
                if pl >= 0:
                    color = {'red': 0.0, 'green': 0.7, 'blue': 0.3}
                else:
                    color = {'red': 0.9, 'green': 0.2, 'blue': 0.2}

                worksheet.format(f'E{i}', {
                    'backgroundColor': color,
                    'textFormat': {
                        'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                        'bold': True
                    }
                })

            # Auto-resize columns
            worksheet.columns_auto_resize(0, len(headers) - 1)

            # Add metadata footer
            last_row = len(rows) + 2
            # Convert to GMT-5 timezone
            gmt_minus_5 = timezone(timedelta(hours=-5))
            now_gmt5 = datetime.now(gmt_minus_5)
            worksheet.update(f'A{last_row}', [[f'Last synced: {now_gmt5.strftime("%Y-%m-%d %H:%M:%S")} (GMT-5)']])
            worksheet.format(f'A{last_row}', {
                'textFormat': {'italic': True, 'fontSize': 9},
                'horizontalAlignment': 'LEFT'
            })

            return {
                "success": True,
                "message": f"Successfully synced {len(accounts)} accounts to Google Sheets",
                "accounts_synced": len(accounts),
                "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}"
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def sync_trade_history(self, trade_history_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync trade history to Google Sheets in a separate "Trade History" worksheet

        Args:
            trade_history_data: Dictionary containing trade history data

        Returns:
            Dictionary with sync status and details
        """
        try:
            # Authenticate if not already done
            if not self.client:
                if not self.authenticate():
                    return {
                        "success": False,
                        "error": "Failed to authenticate with Google Sheets"
                    }

            # Open the spreadsheet
            spreadsheet = self.client.open_by_key(self.spreadsheet_id)

            # Create or get "Trade History" worksheet
            trade_worksheet_name = "Trade History"
            try:
                worksheet = spreadsheet.worksheet(trade_worksheet_name)
            except gspread.exceptions.WorksheetNotFound:
                worksheet = spreadsheet.add_worksheet(
                    title=trade_worksheet_name,
                    rows=2000,
                    cols=15
                )

            # Clear existing data
            worksheet.clear()

            # Prepare headers with all the fields
            headers = [
                'Account Number',
                'Symbol',
                'Side',
                'Lot',
                'Entry Price',
                'Exit Price',
                'Pips',
                'Commission',
                'Profit',
                'Entry Time',
                'Exit Time',
                'Position ID'
            ]

            rows = [headers]

            # Extract trades from the data
            trades = trade_history_data.get('trades', [])
            account_number = trade_history_data.get('account_number', 'N/A')

            # Add all trades
            for trade in trades:
                row = [
                    str(account_number),
                    trade.get('symbol', ''),
                    trade.get('side', ''),
                    trade.get('lot', 0),
                    trade.get('entry_price', 0),
                    trade.get('exit_price', 0),
                    trade.get('pips', 0),
                    trade.get('commission', 0),
                    trade.get('profit', 0),
                    trade.get('entry_time', ''),
                    trade.get('exit_time', ''),
                    trade.get('position_id', '')
                ]
                rows.append(row)

            # Update worksheet with all data
            worksheet.update('A1', rows)

            # Format the header row
            worksheet.format('A1:L1', {
                'backgroundColor': {'red': 0.2, 'green': 0.2, 'blue': 0.2},
                'textFormat': {
                    'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                    'fontSize': 11,
                    'bold': True
                },
                'horizontalAlignment': 'CENTER'
            })

            # Format profit column with colors
            for i, trade in enumerate(trades, start=2):
                profit = trade.get('profit', 0)

                # Color profit cells
                if profit >= 0:
                    color = {'red': 0.0, 'green': 0.7, 'blue': 0.3}
                else:
                    color = {'red': 0.9, 'green': 0.2, 'blue': 0.2}

                worksheet.format(f'I{i}', {
                    'backgroundColor': color,
                    'textFormat': {
                        'foregroundColor': {'red': 1.0, 'green': 1.0, 'blue': 1.0},
                        'bold': True
                    }
                })

            # Auto-resize columns
            worksheet.columns_auto_resize(0, len(headers) - 1)

            # Add summary footer
            last_row = len(rows) + 2
            total_profit = trade_history_data.get('total_profit', 0)
            total_commission = trade_history_data.get('total_commission', 0)
            total_trades = trade_history_data.get('total_trades', 0)

            worksheet.update(f'A{last_row}', [[f'Total Trades: {total_trades}']])
            worksheet.update(f'A{last_row + 1}', [[f'Total Profit: ${total_profit:.2f}']])
            worksheet.update(f'A{last_row + 2}', [[f'Total Commission: ${total_commission:.2f}']])

            # Add timestamp
            gmt_minus_5 = timezone(timedelta(hours=-5))
            now_gmt5 = datetime.now(gmt_minus_5)
            worksheet.update(f'A{last_row + 4}', [[f'Last synced: {now_gmt5.strftime("%Y-%m-%d %H:%M:%S")} (GMT-5)']])
            worksheet.format(f'A{last_row + 4}', {
                'textFormat': {'italic': True, 'fontSize': 9}
            })

            return {
                "success": True,
                "message": f"Successfully synced {len(trades)} trades to Google Sheets",
                "trades_synced": len(trades),
                "spreadsheet_url": f"https://docs.google.com/spreadsheets/d/{self.spreadsheet_id}"
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Singleton instance
google_sheets_service = GoogleSheetsService()
