# Architecture — 05: DTO → Service → VO Data Flow

← [04 — Proxy](./04-proxy.md) | [ARCHITECTURE.md](../ARCHITECTURE.md) | [Blueprint INDEX](../INDEX.md)

---

## Concept

| Layer | Location | Role |
|---|---|---|
| **DTO** | `src/types/dtos/` | Raw API contract — matches server JSON field-for-field |
| **Service** | `src/services/` | Fetches DTO, validates, transforms to VO |
| **VO** | `src/types/value-objects/` | Client-ready shape — formatted, derived, camelCase |
| **Page / Component** | `src/app/[locale]/` | Consumes VO only — never sees raw DTO |

---

## Data Flow

```
External API  (JSON)
    │
    ▼  apiClient returns JSON typed as DTO
DTO  src/types/dtos/<domain>.dto.ts
    │  snake_case fields, ISO date strings, raw booleans, no derived data
    │
    ▼  service maps DTO → VO
Domain Service  src/services/<domain>.service.ts
    │  format dates, derive computed fields, rename keys to camelCase
    │
    ▼  service returns VO
VO  src/types/value-objects/<domain>.vo.ts
    │  camelCase, display-ready strings, derived booleans, no nullables
    │
    ▼
Page / Component  src/app/[locale]/...
    reads VO fields directly — no formatting or null-coalescing in JSX
```

---

## Why separate DTO from VO?

- **Stability** — API shape changes (renamed field, added null) break only the DTO file and the mapping function, not every component.
- **Testability** — mapping logic lives in the service, which is a plain object — unit-testable without rendering.
- **Clarity** — component props are always camelCase with no `string | null | undefined` ambiguity; the VO is the enforced final contract.

---

## Transformation example

```ts
// src/services/admin.service.ts
import { apiClient } from './client';
import type { AdminDTO, AdminListDTO } from '@/types/dtos';
import type { AdminVO, AdminListVO }   from '@/types/value-objects';

const ROLE_LABELS: Record<AdminDTO['role'], string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  moderator:   'Moderator',
};

function toAdminVO(dto: AdminDTO): AdminVO {
  return {
    id:          dto.id,
    fullName:    dto.full_name,
    email:       dto.email,
    role:        dto.role,
    roleLabel:   ROLE_LABELS[dto.role],
    isActive:    dto.is_active,
    statusLabel: dto.is_active ? 'Active' : 'Inactive',
    createdAt:   new Date(dto.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' }),
    initials:    dto.full_name.split(' ').map(n => n.charAt(0)).join('').toUpperCase(),
  };
}

export const adminService = {
  list: async (page = 1): Promise<AdminListVO> => {
    const dto = await apiClient.get<AdminListDTO>('/admins', {
      revalidate: 30,
      tags: ['admins'],
    });
    return {
      items:      dto.data.map(toAdminVO),
      total:      dto.total,
      page:       dto.page,
      pageSize:   dto.page_size,
      totalPages: dto.total_pages,
      isEmpty:    dto.total === 0,
    };
  },

  get: async (id: string): Promise<AdminVO> => {
    const dto = await apiClient.get<AdminDTO>(`/admins/${id}`, {
      tags: [`admin-${id}`],
    });
    return toAdminVO(dto);
  },
};
```

---

## Import rules

```ts
// Services — may import both DTO and VO
import type { AdminDTO, AdminListDTO } from '@/types/dtos';
import type { AdminVO, AdminListVO }   from '@/types/value-objects';

// Pages & Components — VO only
import type { AdminVO } from '@/types/value-objects';
```

**DTOs are an implementation detail of the service layer.** Pages and components must never import from `@/types/dtos`.

---

← [04 — Proxy](./04-proxy.md) | [ARCHITECTURE.md](../ARCHITECTURE.md)
