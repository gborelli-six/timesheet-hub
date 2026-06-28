# ADR-004 — Convenzioni ORM: TimestampMixin e pattern enum PostgreSQL

- **Stato**: Accettato
- **Data**: 2026-06-28
- **Contesto**: STORY-011 (E2 — Fondamenta dati & autorizzazione)

---

## Problema

Ogni modello SQLAlchemy del progetto deve registrare automaticamente quando un record è creato o aggiornato, senza che ogni autore ripeta il codice. Allo stesso tempo, gli enum PostgreSQL nativi richiedono una naming convention esplicita per essere gestiti in modo coerente da Alembic (autogenerate + migrazioni ripetibili).

---

## Decisioni

### ADR-004-A — TimestampMixin

**Ogni modello persistente eredita `TimestampMixin` da `app.db.mixins`.**

```python
# backend/app/db/mixins.py
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

**Regole d'uso**:
- Inserire `TimestampMixin` prima di `Base` nella lista di eredità: `class MyModel(TimestampMixin, Base)`.
- Non ridefinire `created_at` o `updated_at` localmente nel modello.
- `server_default=func.now()` delega il calcolo al database (PostgreSQL `now()`), garantendo coerenza anche in bulk insert senza ORM.
- `onupdate=func.now()` aggiorna il valore lato ORM ad ogni `session.flush()` che modifica la riga.

**Perché non `default=func.now()` (Python-side)**:
I bulk insert e le operazioni dirette via SQL non passano dall'ORM Python; `server_default` garantisce il valore anche in quei casi.

---

### ADR-004-B — Pattern enum PostgreSQL

**Per ogni colonna enum usare `SQLAlchemyEnum` con `native_enum=True` e `create_type=True`.**

```python
import enum
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column

class ImportStatus(enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"

class ImportJob(TimestampMixin, Base):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    status: Mapped[ImportStatus] = mapped_column(
        SQLAlchemyEnum(
            ImportStatus,
            name="import_jobs_status_enum",
            create_type=True,
            native_enum=True,
        )
    )
```

**Naming convention enum**: `%(table_name)s_%(column_0_name)s_enum`.

Esempio: colonna `status` sulla tabella `import_jobs` → tipo PostgreSQL `import_jobs_status_enum`.

> ⚠️ La `naming_convention` del `MetaData` si applica solo a constraint e indici, **non** ai nomi dei tipi ENUM nativi PostgreSQL. Senza `name=` esplicito SQLAlchemy deriva il nome dalla classe Python (es. `importstatus`), vanificando la convenzione. Il nome va quindi passato a mano a ciascun `SQLAlchemyEnum` seguendo il pattern `%(table_name)s_%(column_0_name)s_enum`.

**Regole d'uso**:
- `name="<tabella>_<colonna>_enum"`: nome del tipo PostgreSQL, obbligatorio e deterministico (la naming convention non copre gli enum).
- `create_type=True`: Alembic genera automaticamente `CREATE TYPE … AS ENUM` nella migrazione.
- `native_enum=True`: PostgreSQL usa il tipo nativo (non `VARCHAR` con CHECK constraint).
- Valori enum: preferire stringhe lowercase snake_case come `.value` per leggibilità nelle query SQL dirette.
- **Aggiungere un valore** a un enum PostgreSQL richiede `ALTER TYPE … ADD VALUE` — Alembic non lo genera in autogenerate; aggiungere manualmente nella migrazione.
- **Rimuovere un valore** richiede di ricreare il tipo — pianificare la migrazione con cura (vedi checklist in STORY-012).

---

### ADR-004-C — Naming convention globale (riepilogo)

Tutte le constraint names seguono le regole in `backend/app/db/conventions.py`:

| Tipo | Pattern | Esempio |
|------|---------|---------|
| Index | `ix_%(column_0_label)s` | `ix_users_email` |
| Unique | `uq_%(table_name)s_%(column_0_name)s` | `uq_users_email` |
| Check | `ck_%(table_name)s_%(constraint_name)s` | `ck_users_role_valid` |
| Foreign key | `fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s` | `fk_import_jobs_user_id_users` |
| Primary key | `pk_%(table_name)s` | `pk_users` |

Queste convenzioni sono imposte a livello di `MetaData` e quindi si applicano a tutti i modelli che ereditano da `Base`.

> Gli enum nativi PostgreSQL **non** sono coperti dalla `naming_convention` del `MetaData`: il nome del tipo va passato esplicitamente via `name=` su ogni `SQLAlchemyEnum`, seguendo il pattern `%(table_name)s_%(column_0_name)s_enum` (vedi ADR-004-B).

---

### ADR-004-D — Workflow Alembic

**Naming convention file di migrazione**: `NNNN_verbo_oggetto.py`

Esempi: `0001_init_baseline.py`, `0002_create_users.py`, `0003_add_import_jobs.py`.

Comandi canonici (definiti nel `Makefile`):

| Operazione | Comando |
|------------|---------|
| Genera migrazione | `make makemigration` (wrappa `alembic revision --autogenerate -m "…"`) |
| Applica migrazioni | `make migrate` (wrappa `alembic upgrade head`) |
| Rollback un passo | `alembic downgrade -1` |
| Stato corrente | `alembic current` |

**Checklist review per ogni migrazione** (obbligatoria prima del merge):

- [ ] `downgrade()` implementato e testato (`alembic downgrade -1` non solleva errori)
- [ ] Nessun dato distrutto senza commento `# WARNING: distruttivo` esplicito nel file
- [ ] Tipi PostgreSQL compatibili con le convenzioni ADR-004-B (enum con `create_type=True`) e ADR-004-C (naming constraint)
- [ ] Colonne NOT NULL aggiunte in due passi: prima `nullable=True` (migrazione A), poi `nullable=False` dopo backfill (migrazione B)
- [ ] `alembic upgrade head` + `alembic downgrade -1` + `alembic upgrade head` eseguiti in locale senza errori

**Eccezioni note**:
- `ALTER TYPE … ADD VALUE` per aggiungere un valore a un enum PostgreSQL **non è generato da autogenerate**: aggiungere manualmente nella migrazione con `op.execute("ALTER TYPE nome_enum ADD VALUE 'nuovo_valore'")`.
- Rimuovere un valore enum richiede la ricreazione del tipo — pianificare come migrazione multi-step.

---

## Conseguenze

- Tutti i modelli futuri avranno automaticamente audit timestamps senza boilerplate.
- Alembic `--autogenerate` produce nomi di constraint stabili e ripetibili.
- Gli enum PostgreSQL nativi sono type-safe a livello DB e integrano con Alembic senza configurazione aggiuntiva per i casi standard (aggiunta valore → eccezione documentata sopra).
- Le migrazioni seguono una naming convention e checklist formale che riduce il rischio di regressioni in fase di deploy (pre-deploy `alembic upgrade head` su Railway).
