# Care 365 Invoice Generator

The invoice page (`index.html`) and estimate page (`estimate.html`) can save documents to Cloud Firestore. Invoices and estimates use separate collections and saved-document pickers, so the two document types remain independent. The app does not use Firebase Authentication or Cloud Storage.

## Firestore setup

1. Create a Firebase project and register a Web app in the Firebase console.
2. Create a Cloud Firestore database and configure Firestore Security Rules for your deployment.
3. Copy `firebase-config.example.js` to `firebase-config.js` and replace its placeholder values with the Firebase Web app configuration from Project settings.
4. Serve this folder from a local or hosted HTTP server, then open either page to connect Firestore. The editors still work from `file://`, but the Firebase configuration module and CDN SDK require an HTTP origin.

The Web app configuration is client-side configuration, not a server credential. `firebase-config.js` is ignored by Git so local project values are not accidentally committed. The Firebase SDK is loaded from Google's CDN when the invoice page starts; the rest of the invoice editor remains usable if Firestore is not configured or available.

Invoices are stored in the `invoices` collection and estimates in the `estimates` collection. Each stores its document number, date, customer details, line items, and Firestore timestamps. Use the saved-document picker to load one, then update or delete it; **Save New Invoice** or **Save New Estimate** creates a separate document. The estimate editor opens with its example line items pre-filled.

## Access and privacy

This app deliberately has no user identity or authentication. Firestore Security Rules cannot distinguish individual users in that setup, so do not deploy rules that grant unrestricted unauthenticated access to invoice data. Configure access for your trusted deployment before enabling Firestore, and treat any data accessible to the client as visible to its users. If private, per-user invoices are required, an authenticated or trusted server-side access layer is needed; that is outside the current app scope.
