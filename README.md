# Retail Manager (Android starter)

A mobile-first, single-store retail management app built with Expo + React Native.

## Included in this MVP
- Dashboard with today's sales, order count, product count and low-stock alerts
- Product inventory: add, edit, delete and search
- POS cart with quantity controls and stock validation
- Checkout that creates a sale and deducts inventory
- Sales history
- NPR currency formatting
- Local on-device persistence with AsyncStorage

## Run it
1. Install Node.js (LTS) on a computer.
2. Extract this project folder.
3. In the project folder run:
   ```bash
   npm install
   npx expo start
   ```
4. Install **Expo Go** on an Android phone and scan the QR code while both devices are on the same network.

## Build an installable Android APK
For a development/preview APK using Expo Application Services:
1. Create an Expo account and install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. Configure the project:
   ```bash
   eas build:configure
   ```
3. Build an APK:
   ```bash
   eas build -p android --profile preview
   ```
   If prompted, create an `eas.json` with:
   ```json
   {
     "build": {
       "preview": {
         "distribution": "internal",
         "android": { "buildType": "apk" }
       }
     }
   }
   ```

## Important limitations
- This is a functional starter MVP, not a production accounting system.
- Data is stored locally on one device. There is no cloud backup, multi-user login, online sync, barcode scanning, tax configuration, supplier purchasing, expense ledger, or PDF receipt printing yet.
- Sales are treated as completed cash-like transactions. Add payment methods, refunds and tax rules before using it for real business accounting.
- Sample products are demo data. Replace them with your store's actual inventory.
