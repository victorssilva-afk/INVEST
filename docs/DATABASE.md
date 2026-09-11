# Base de dados — INVEST (MongoDB)

Isolamento multi-tenant: quase todas as coleções têm `tenant_id`. Uma Mesa nunca acede a dados de outra.

## Coleções
- **users**: `id, name, email, password_hash (bcrypt), role (admin|agente), tenant_id, active`
- **clients**: `id, tenant_id, name, company, nif, email, phone, address, city, postal_code, country`
- **invoices**: `id, number (FAT-<ano>-<6díg>), tenant_id, issue_date, due_date, due_label, status, currency, sender, client_id, recipient, items[], totals{subtotal,discount,vat,total}, bank, international, notes, company_message, agent_id, agent_name, public_link, qr_code, status_history[], created_at, updated_at`
- **counters**: `_id (tenant:ano), seq` (numeração atómica)
- **proofs**: `id, invoice_id, invoice_number, tenant_id, filename, file_data (base64), message, status (pendente|aceite|recusado|pedir_novo)`
- **uploads**: `id, tenant, tenant_id, filename, file_data, sender_name, created_at`
- **settings**: `tenant_id, sender, bank, default_currency`
- **history**: `id, action, entity, entity_id, user, tenant_id, at`
- **contracts / templates**
- **calc_profiles**: `id, name, tenant_id, status` · **calc_entries**: `id, profile_id, tenant_id, deposit, date, bonus, total, payment_friday, status`
- **crypto_analysis**: `id, tenant_id, asset, timeframe, *_score, final_score, confidence, trend, factors[], report, sources[], generated_at`
- **crypto_watchlist**: `tenant_id, symbols[]`
- **login_attempts**: proteção brute-force (5 tentativas → bloqueio 15 min)

## Índices
- `users.email` (único), `invoices.(tenant_id, number)`, `clients.tenant_id`
