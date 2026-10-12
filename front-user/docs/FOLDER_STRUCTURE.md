# Folder Structure

This document describes the main folder and file organization for the project, including comments for each section.

```text
src/
│
├── app/                              # Next.js App Router main directory (RSC + Server boundaries)
│   ├── (auth)/                       # Route group for authentication pages
│   │   ├── layout.tsx                # Server Component layout delegating to AuthBackground
│   │   └── login/
│   │       └── page.tsx              # RSC login page mounting LoginForm
│   │
│   ├── (main)/                       # Route group for protected pages
│   │   ├── layout.tsx                # RSC layout delegating to MainLayoutShell (AuthGuard)
│   │   ├── page.tsx                  # RSC main page mounting PageLayout
│   │   ├── checkout/
│   │   │   └── page.tsx              # Client checkout page (CheckoutHeader, DeliveryAddressCard, PaymentMethodSelector, OrderSummaryCard)
│   │   ├── order/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Client order tracking page (OrderTrackingHeader/Map/Timeline, DriverCard, DetailsAccordion, RatingModal)
│   │   └── store/
│   │       └── [slug]/
│   │           └── page.tsx          # Dynamic store catalog RSC page with async params
│   │
│   ├── layout.tsx                    # Root layout (imports globals.css, metadata, viewport)
│   ├── error.tsx                     # Segment error boundary
│   ├── global-error.tsx              # Root global error boundary
│   ├── not-found.tsx                 # 404 Not Found page
│   ├── globals.css                   # Global styles + Tailwind CSS
│   └── favicon.ico                   # Favicon
│
├── components/                       # React UI components
│   ├── auth/                         # Authentication components
│   │   ├── AuthBackground.tsx        # Cyberpunk/atomic interactive background with particles
│   │   ├── MagneticBackground.tsx    # Interactive magnetic-field background (filings follow pointer/touch, idle/email/password moods)
│   │   ├── AuthFieldContext.tsx      # Bridge context emitting LoginForm events to the background engine
│   │   └── LoginForm.tsx             # Login form component with validation
│   │
│   ├── layout/                       # Page structural components
│   │   ├── AppHeader.tsx             # App header with user info and logout
│   │   ├── FilterBanner.tsx          # Category filter bar with animated SVG icons
│   │   ├── InfoPanel.tsx             # Mobile info panel (StoreCard or AdCarousel)
│   │   ├── MainLayoutShell.tsx       # Protected client wrapper with AuthGuard & toast viewport
│   │   ├── MapSection.tsx            # Dynamic wrapper (ssr: false) for MapContainer
│   │   ├── PageLayout.tsx            # Main layout (map + panel/list + header)
│   │   └── StoresList.tsx            # Desktop list of nearby stores
│   │
│   ├── map/                          # Map-specific components
│   │   ├── LocationControlProvider.tsx # Location permission + center-map orchestration
│   │   ├── LocationPermissionModal.tsx # Permission prompt modal UI
│   │   ├── MapContainer.tsx          # Mapbox GL initialization and data orchestration
│   │   ├── StoreMarker.tsx           # Custom marker component
│   │   ├── controls/                 # Map controls components
│   │   │   ├── ZoomControl.tsx       # Futuristic energy-bar zoom slider
│   │   │   └── LocationButton.tsx    # Electric ripple location button
│   │   └── layers/
│   │       └── StoresLayer.tsx       # Renders map markers for current stores
│   │
│   ├── stores/                       # UI components related to stores & catalog
│   │   ├── CartButton.tsx            # Floating cart CTA in store page
│   │   ├── CartDrawer.tsx            # Drawer pre-checkout with swipe-to-delete & reactive totals
│   │   ├── ProductCard.tsx           # Product card in catalog grid
│   │   ├── ProductGrid.tsx           # Responsive product grid
│   │   ├── ProductIcon.tsx           # Animated holographic SVG product icon
│   │   ├── ProductModal.tsx          # Product detail modal + quantity selector
│   │   ├── StoreCard.tsx             # Holographic store info card
│   │   ├── StoreConflictDialog.tsx   # Explicit confirmation dialog for multi-store switch
│   │   ├── StoreHeader.tsx           # Store page header (rating, schedule, delivery info)
│   │   └── StoreView.tsx             # Client catalog view orchestration
│   │
│   ├── checkout/                     # Checkout flow components
│   │   ├── CheckoutHeader.tsx        # Checkout header with back navigation + seal
│   │   ├── DeliveryAddressCard.tsx   # Delivery address card (locationStore + DeliveryAddress type)
│   │   ├── PaymentMethodSelector.tsx # Payment method selector (PaymentMethod type)
│   │   └── OrderSummaryCard.tsx      # Order summary with CartItem/OrderBreakdown
│   │
│   ├── tracking/                     # Order tracking / delivery components
│   │   ├── OrderTrackingHeader.tsx   # Tracking page header
│   │   ├── OrderTrackingMap.tsx      # Mapbox order tracking map
│   │   ├── OrderTimeline.tsx         # Order status timeline
│   │   ├── DriverCard.tsx            # Driver info card (DriverInfo type)
│   │   ├── OrderDetailsAccordion.tsx # Order details accordion (Order type)
│   │   ├── OrderRatingModal.tsx      # Order rating modal (OrderRating type)
│   │   └── ActiveOrdersDrawer.tsx    # Drawer listing active orders
│   │
│   └── ui/                           # Generic and reusable UI components
│       ├── AdCarousel.tsx            # Commercial banner carousel
│       ├── LoadingIndicator.tsx      # Spinner loading indicator
│       └── ToastViewport.tsx         # Global toast notification viewport
│
├── types/                            # Domain TypeScript contracts and models
│   ├── common.ts                     # Coordinates, GeoBoundingBox, ActionResult
│   ├── auth.ts                       # User, UserRole, AuthState, LoginCredentials
│   ├── store.ts                      # Store, StoreCategory, StoreSchedule, StoreDeliveryInfo
│   ├── product.ts                    # Product, ProductSpecs, ProductCompatibility
│   ├── cart.ts                       # CartItem, CartSummary, CartNotice, CartActionResult
│   ├── order.ts                      # PaymentMethod, OrderStatus, DeliveryAddress, OrderBreakdown (Order/DriverInfo/Rating contract for checkout/tracking/orderStore)
│   ├── toast.ts                      # Toast, ToastVariant, ToastPayload
│   ├── declarations.d.ts             # CSS & window global ambient declarations
│   └── index.ts                      # Barrel re-export file
│
├── store/                            # Zustand stores for global state management
│   ├── authStore.ts                  # Store for authentication (user session, login/logout)
│   ├── cartStore.ts                  # Persistent cart store (store context, items, immer, hooks)
│   ├── filterStore.ts                # Store for active category filters
│   ├── locationStore.ts              # Store for location, permissions, tracking
│   ├── orderStore.ts                 # Persistent orders store (multi-order, Enfoque B puro)
│   ├── storesStore.ts                # Nearby stores state and selection
│   ├── toastStore.ts                 # Global toast notifications store
│   └── __tests__/                    # Vitest suites (cartStore, orderStore, authStore, storesStore)
│
├── services/                         # Business logic, interaction with external APIs
│   ├── api.ts                        # Catálogo real sobre Supabase (RPC get_nearby_stores + stores/products, adaptadores DB→dominio)
│   ├── supabaseClient.ts             # Singleton diferido del cliente Supabase (único importador de la lib)
│   ├── authService.ts                # Authentication service (mock login/logout)
│   └── geolocationService.ts         # Browser geolocation abstraction
│
├── lib/                              # Pure utilities, helpers, constants
│   ├── analytics.ts                  # Minimal telemetry sink (track, dev-only debug)
│   ├── constants.ts                  # Constants (defaults, permission states, common errors)
│   ├── geoUtils.ts                   # Geospatial utility functions (haversine formula)
│   ├── storageSync.ts                # Cross-tab sync via StorageEvent (enableCrossTabSync)
│   └── __tests__/                    # Vitest suites (storageSync, analytics)
│
├── test/
│   └── setup.ts                      # Vitest global setup (in-memory localStorage for node env)
│
└── data/                             # Static application data
    └── products.ts                   # Mock catalog products and lookup helpers
```
