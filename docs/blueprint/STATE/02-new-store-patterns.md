# State — 02: New Store, DevTools, Decision Tree, Selectors

← [01 — App store, cookies](./01-appstore-cookies.md) | [STATE.md](../STATE.md) | [Blueprint INDEX](../INDEX.md)

---

## Creating a New Store

```ts
// src/stores/cart.store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface CartItem { id: string; quantity: number; }

interface CartState   { items: CartItem[]; }
interface CartActions {
  addItem:    (item: CartItem) => void;
  removeItem: (id: string) => void;
  clear:      () => void;
}

const INITIAL_STATE: CartState = { items: [] };

export const useCartStore = create<CartState & CartActions>()(
  devtools(
    persist(
      (set) => ({
        ...INITIAL_STATE,
        addItem:    (item) => set((s) => ({ items: [...s.items, item] }), false, 'cart/addItem'),
        removeItem: (id)   => set((s) => ({ items: s.items.filter((i) => i.id !== id) }), false, 'cart/removeItem'),
        clear:      ()     => set(INITIAL_STATE, false, 'cart/clear'),
      }),
      { name: 'cart' },             // localStorage key: 'cart' (default)
      // use createCookieStorage() if SSR-readable persistence is needed
    ),
    { name: 'CartStore' },          // DevTools label
  ),
);
```

| Convention | Pattern |
|---|---|
| Store file | `<domain>.store.ts` |
| Export name | `use<Domain>Store` |
| DevTools action names | `'<domain>/<actionName>'` |
| Reset anchor | `INITIAL_STATE` constant |

Export from [src/stores/index.ts](../../../src/stores/index.ts).

---

## DevTools Action Naming

```ts
set({ theme: 'dark' }, false, 'app/setTheme');
//                      ↑ replace (false = merge)
//                             ↑ action name in Redux DevTools
```

Store label in DevTools: set via `devtools({ name: 'AppStore' })`.

---

## Storage Decision Tree

```
Need state server-side (SSR)?
├── Yes → createCookieStorage from src/stores/middleware/cookie-storage.ts
└── No  → Survive page reload?
           ├── Yes → Zustand persist with localStorage (default)
           └── No  → Is it truly global?
                       ├── Yes → Zustand in-memory (no persist middleware)
                       └── No  → useState / useReducer in component
```

---

## Selectors — Performance Rule

```ts
// ✅ re-renders only when theme changes
const theme = useAppStore((s) => s.theme);

// ❌ re-renders on ANY store change
const store = useAppStore();
const theme = store.theme;
```

Derived state inside selector:
```ts
const hasItems   = useCartStore((s) => s.items.length > 0);
const totalCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
```

---

← [01 — App store, cookies](./01-appstore-cookies.md) | [STATE.md](../STATE.md)
