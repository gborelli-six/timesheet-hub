# ADR-005 — Gestione sicura delle credenziali dei connettori per-utente

- **Stato**: Accettato
- **Data**: 2026-06-28
- **Contesto**: E5 (Profilo & token utente)

---

## Problema

Ogni utente di Timesheet Hub configura uno o più connettori (Jira, Odoo, Linear, Asana) per inviare i propri worklog. Ciascun connettore richiede due informazioni distinte:

- un **identificativo** (username / email / account) — necessario per sapere "con quale identità" si chiama il backend esterno;
- un **segreto** (API token o password) — la credenziale vera e propria.

Requisiti di sicurezza:

- I segreti non devono mai essere salvati in chiaro nel database.
- I segreti non devono mai essere mostrati di nuovo dopo l'inserimento: l'utente può solo **usarli** (a runtime, durante l'import) o **sostituirli** (write-only). Non esiste un'operazione di "lettura del segreto".

`ADR-001-H` aveva già fissato la direzione (due livelli di secret; token per-utente cifrati AES-256-GCM con IV random per record; chiave master `TOKEN_ENCRYPT_KEY`; tabella `user_tokens(user_id, service, token_enc, iv, updated_at)`), ma in forma incompleta. Mancavano tre decisioni che questo ADR rende operative:

1. Come gestire l'**identificativo** (username/email), che non è un segreto e conviene poter mostrare e modificare — lo schema di `ADR-001-H` aveva solo `token_enc`.
2. Il **contratto API write-only** preciso: cosa torna in lettura, come si separa l'aggiornamento dell'username da quello del segreto.
3. Dettagli crittografici: legare il ciphertext al record (AAD) e versionare la chiave per la rotazione.

Questo ADR approfondisce e sostituisce lo schema dati abbozzato in `ADR-001-H`.

---

## Decisioni

### ADR-005-A — Modello dati: identificativo in chiaro, segreto write-only cifrato

La tabella `user_tokens` eredita `TimestampMixin` (`ADR-004-A`) e segue le convenzioni di naming/enum di `ADR-004`.

| Campo | Tipo | Note |
|---|---|---|
| `id` | PK | UUID, immutabile dopo la creazione |
| `user_id` | FK → `users` | `fk_user_tokens_user_id_users` |
| `service` | enum nativo `user_tokens_service_enum` | `jira` / `odoo` / `linear` / `asana` (pattern `ADR-004-B`) |
| `label` | `String(255)`, non nullable | nome utente del connettore (es. "Jira Azienda", "Jira Cliente"); distingue istanze multiple dello stesso servizio |
| `base_url` | `String(512)`, nullable | URL dell'istanza per servizi self-hosted (Jira, Odoo); `null` per SaaS puri (Linear, Asana) |
| `account_identifier` | `String(255)`, nullable | username / email **in chiaro**, mostrabile e modificabile |
| `secret_enc` | `LargeBinary` | segreto cifrato AES-256-GCM (sostituisce `token_enc`) |
| `nonce` | `LargeBinary(12)` | IV/nonce a 96-bit, **unico per ogni scrittura** |
| `key_version` | `SmallInteger`, default `1` | versione della chiave master (vedi ADR-005-D) |
| `created_at` / `updated_at` | da `TimestampMixin` | audit timestamps |

- `UniqueConstraint(user_id, label)` → `uq_user_tokens_user_id_label`: la combinazione utente + label deve essere unica. Questo consente a un utente di avere più connettori dello stesso `service` (es. due istanze Jira distinte), differenziati dalla `label` assegnata al momento della creazione.
- **`label`**: fornita dall'utente alla creazione; se omessa, il default è il nome del servizio. Non è un segreto, è mostrabile e modificabile.
- **`base_url`**: dati non sensibili, inclusi nelle risposte `GET`. Obbligatorio in pratica per Odoo e Jira self-hosted; irrilevante (e `null`) per Linear e Asana.
- **`account_identifier` non è write-only**: è un dato di identità, non un segreto. Resta in chiaro così da poter essere mostrato e modificato nel profilo (UX "connesso come `mario.rossi@…`").
- **`secret_enc` è write-only**: non viene mai serializzato verso il client (vedi ADR-005-C). L'unico modo per cambiarlo è sovrascriverlo.

### ADR-005-B — Cifratura: AES-256-GCM con AAD legato al record

- Libreria [`cryptography`](https://cryptography.io/) — `from cryptography.hazmat.primitives.ciphers.aead import AESGCM`. Va aggiunta alle dipendenze in `backend/pyproject.toml`.
- **Chiave**: `TOKEN_ENCRYPT_KEY` (già presente in `backend/app/core/config.py` come `token_encrypt_key`), 32 byte / 256-bit. Generazione: `python -c "import secrets; print(secrets.token_hex(32))"`.
- **Nonce**: `os.urandom(12)` (96-bit) nuovo a ogni scrittura, salvato in chiaro accanto al ciphertext nella colonna `nonce`. È lo standard per AES-GCM e non è un segreto. **Invariante di sicurezza inderogabile**: la coppia `(key_version, nonce)` non deve mai ripetersi. Riusare lo stesso nonce con la stessa chiave su plaintext diversi rompe GCM in modo catastrofico (recupero del keystream + forge dell'auth tag). Con nonce casuali a 96-bit la probabilità di collisione è trascurabile entro i volumi attesi (pochi token per utente, sostituzioni rare; ampiamente sotto il birthday bound di ~2³² scritture per chiave); la rotazione (ADR-005-D) azzera il conteggio per la nuova chiave. **Ogni scrittura — incluso il re-encrypt batch — genera SEMPRE un nuovo nonce**.
- **AAD (Associated Additional Data)** = `f"{user_id}:{connector_id}".encode()`, dove `connector_id` è l'UUID del record `user_tokens`, passato come `associated_data` sia in cifratura sia in decifratura. Lega il ciphertext al record specifico: un blob `secret_enc` copiato su un altro record fa fallire la decifratura con `InvalidTag`. Difesa contro tampering e "ciphertext swap" a livello DB.

  **Motivazione del cambio da `user_id:service` a `user_id:connector_id`**: con la vecchia AAD, due connettori Jira dello stesso utente (`user_id:jira`) avrebbero la stessa AAD — rendendo irrilevabile uno swap dei blob `secret_enc` tra i due record. L'UUID del record è immutabile dopo la creazione e garantisce l'unicità dell'AAD per ogni ciphertext. **`user_id` per l'AAD deriva sempre dal JWT di sessione, mai dal body/query** (così l'AAD non è influenzabile dal client).

Helper in `backend/app/core/security.py`:

```python
def encrypt_secret(plaintext: str, user_id: int, connector_id: str) -> tuple[bytes, bytes, int]:
    """Ritorna (secret_enc, nonce, key_version)."""

def decrypt_secret(secret_enc: bytes, nonce: bytes, user_id: int, connector_id: str, key_version: int) -> str:
    """Ritorna il plaintext; solleva InvalidTag se manomesso o chiave errata."""
```

Il plaintext è decifrato **solo** al momento della chiamata API esterna durante l'import e immediatamente scartato. **Mai loggato**: né in log applicativi, né in messaggi di eccezione, né in tracce di debug. Per rendere la prescrizione un meccanismo e non una mera convenzione: il segreto va trasportato in un wrapper che maschera `repr`/`__str__` (es. Pydantic `SecretStr`); l'eccezione `InvalidTag` non deve mai includere ciphertext, nonce o chiave nel messaggio propagato.

**Contratto su `InvalidTag`**: una `InvalidTag` a runtime significa DB manomesso o chiave disallineata — è un **errore di integrità**, non un segreto mancante né un 401 esterno (che ADR-005-C tratta separatamente). Va catturata, tradotta in un errore generico verso il client (es. 500) e segnalata/allertata, senza esporre dettagli crittografici.

### ADR-005-C — Contratto API write-only

Endpoint sotto `/api/me/connectors`, tutti protetti da `Depends(require_role([...]))` (`ADR-001-G`) e operanti **esclusivamente sul `user_id` della sessione**. I token sono personali: nessun utente — HR o admin inclusi — legge o scrive i connettori di un altro.

- **`GET /api/me/connectors`** → lista di `{service, label, base_url, account_identifier, configured: bool, updated_at}`. **Il segreto non è mai serializzato**, in nessuna risposta. `configured` indica che un segreto è presente: poiché `secret_enc` è `NOT NULL` e il segreto è obbligatorio alla creazione (vedi sotto), è sempre `true` per ogni record esistente; il campo è mantenuto nel contratto per evolvere verso modelli futuri (es. OAuth a più step) senza rompere il client. `base_url` è dati non sensibili ed è incluso.
- **`PUT /api/me/connectors/{label}`** → body `{service?, account_identifier?, secret?, base_url?}`, semantica upsert:
  - `secret` valorizzato → cifra e sostituisce, generando un **nuovo `nonce`** (e azzera `needs_reauth`);
  - `secret` assente / `null` su record **esistente** → il segreto resta **invariato** (consente di aggiornare il solo `account_identifier` o `base_url`);
  - **creazione** (record **inesistente**) → `service` e `secret` sono **obbligatori**: la loro assenza restituisce `422`. Non si creano connettori "vuoti" senza segreto (`secret_enc` è `NOT NULL`);
  - `account_identifier` e `base_url` aggiornabili liberamente, in chiaro. Il `service` è fissato alla creazione e **non è aggiornabile** su record esistente.
  - La `label` è fornita dall'utente alla creazione; se omessa, il default è il nome del servizio. Non è modificabile dopo la creazione (è parte dell'identità del connettore; cambiare label richiederebbe un DELETE + re-create).
- **`DELETE /api/me/connectors/{label}`** → rimuove il connettore.

Gli schemi Pydantic devono modellare `secret` come campo **solo di input** (mai presente nei response model), così che sia strutturalmente impossibile esporlo, con un **`max_length` esplicito** (es. 4096) per impedire DoS via payload sovradimensionato in cifratura.

### ADR-005-D — Rotazione della chiave master

- `key_version` abilita la rotazione **senza downtime**: le nuove scritture usano la chiave corrente; uno script batch ricifra i record con `key_version` precedente — leggendo la vecchia chiave, decifrando, e riscrivendo con la nuova chiave **e un nuovo nonce**.
- **Requisito multi-chiave**: durante la finestra di rotazione devono coesistere almeno la chiave corrente e la precedente, con un mapping esplicito `key_version → chiave materiale` (es. `TOKEN_ENCRYPT_KEY_V1`, `TOKEN_ENCRYPT_KEY_V2`, oppure una mappa in config), così che `decrypt_secret(..., key_version)` sappia quale chiave caricare. La singola `TOKEN_ENCRYPT_KEY` odierna corrisponde a `key_version=1`.
- `TOKEN_ENCRYPT_KEY` è gestita come Secret Variable Railway per environment (`ADR-002-G`), mai nel repository.
- **Trade-off** (già accettato in `ADR-001`): la chiave è condivisa a livello di sistema. Se compromessa, tutti i token utente sono a rischio. Accettabile per uno strumento interno; una chiave per-utente richiederebbe un key management sensibilmente più complesso senza benefici proporzionati al modello di minaccia.

---

## Conseguenze

**Positive:**
- I segreti non sono mai in chiaro nel DB né esposti via API: write-only by design, impossibile da rileggere.
- L'`account_identifier` resta mostrabile e modificabile, migliorando la UX del profilo senza compromettere il segreto.
- L'AAD lega ogni ciphertext al suo record: tampering e swap a livello DB falliscono in modo rilevabile.
- `key_version` rende la rotazione della chiave un'operazione di manutenzione, non un evento distruttivo.

**Trade-off accettati:**
- Chiave master condivisa di sistema (vedi ADR-005-D): single point of failure crittografico, accettato per il modello di minaccia interno.
- La rotazione richiede uno script di re-encrypt batch (non automatica).
- Un errore `401` dal backend esterno a runtime non è distinguibile a priori da un segreto valido: si scopre solo al momento dell'uso e genera una notifica all'utente di aggiornare la credenziale (vedi E5).

---

## Decisioni aperte

- Formato e scheduling dello script di re-encrypt per la rotazione di `TOKEN_ENCRYPT_KEY`.
- Eventuale audit log delle operazioni di scrittura/eliminazione dei connettori (chi, quando — mai il valore).
- Estensione del modello per backend che richiedono più di un segreto (es. OAuth con refresh token) — rinviata a quando un adapter concreto lo imporrà. La `label` e `base_url` già coprono il caso di istanze multiple dello stesso servizio.
