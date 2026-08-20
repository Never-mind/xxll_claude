# 20260820 Product PO Quotation Upgrade Backup

This snapshot preserves the upgrade baseline before the product, customer PO, and quotation workflow redesign.

## Database backup

- Database: `quotation`
- Export file: `quotation-20260820-product-po-quotation-upgrade.sql`
- Export method: MySQL logical dump with schema, data, triggers, routines, and events
- MySQL version: `8.0.46`
- SHA-256: `409ECE746202AB3EF082BAEA593BE34A9A6B6C28A03B85EC201DDC2BD9511FE2`

## Restore

Verify the SQL file before restoration:

```powershell
Get-FileHash -LiteralPath .\backups\quotation-20260820-product-po-quotation-upgrade.sql -Algorithm SHA256
```

Restore into a MySQL instance after setting the appropriate account and password:

```powershell
mysql -u root -p < .\backups\quotation-20260820-product-po-quotation-upgrade.sql
```

The SQL dump contains business records and attachments. Keep the repository private and restrict access to authorized personnel.
