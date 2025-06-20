# Component Documentation

This document describes the React components in the Blackbaud OAuth React Application.

## Component Architecture

The application uses a modern React architecture with:
- **TypeScript** for type safety
- **React Router** for navigation
- **React i18next** for internationalization
- **Lazy loading** for performance optimization
- **Suspense** for loading states

## Core Components

### App.tsx
**Location**: `src/App.tsx`

The main application component that handles:
- Authentication state management
- Routing configuration
- Lazy loading of components
- Loading states with Suspense

**Key Features**:
- Automatic authentication checking on app load
- Route protection based on authentication status
- Lazy loading with loading fallbacks
- Internationalization support

**Props**: None

**State**:
- `sessionInfo`: Current authentication session
- `loading`: Loading state during authentication check

### Dashboard.tsx
**Location**: `src/components/Dashboard.tsx`

The main dashboard component with tabbed interface.

**Key Features**:
- Tabbed navigation (Gifts, Lists, Queries, Profile, Cache Stats)
- Session information display
- Logout functionality
- Responsive design

**Props**:
- `sessionInfo`: Session information from authentication service

**Tabs**:
- **🎁 Gifts**: Gift data display and management
- **📝 Lists**: Blackbaud lists management
- **🔍 Queries**: Query execution and results
- **👤 Profile**: User profile information
- **📊 Cache Stats**: Cache performance monitoring

### Home.tsx
**Location**: `src/components/Home.tsx`

The landing page component for unauthenticated users.

**Key Features**:
- Login button
- Application description
- Feature highlights
- Modern UI design

**Props**: None

### LoginButton.tsx
**Location**: `src/components/LoginButton.tsx`

Component for initiating OAuth login.

**Key Features**:
- Login button with styling
- Integration with authentication service
- Loading states

**Props**: None

### Logout.tsx
**Location**: `src/components/Logout.tsx`

Component for handling user logout.

**Key Features**:
- Logout confirmation
- Automatic redirect after logout
- Error handling

**Props**: None

### LanguageSelector.tsx
**Location**: `src/components/LanguageSelector.tsx`

Component for language selection and internationalization.

**Key Features**:
- Language switching (English, French, French Canadian)
- Persistent language selection
- Automatic language detection

**Props**: None

## Data Display Components

### GiftList.tsx
**Location**: `src/components/GiftList.tsx`

**Size**: 48KB, 1418 lines

The main component for displaying gift data with comprehensive features.

**Key Features**:
- Gift data table with expandable rows
- Image attachment previews
- PDF viewer integration
- Pagination support
- Search and filtering
- Export functionality
- Constituent information display
- Advanced data formatting

**Props**:
- `sessionInfo`: Session information
- Various configuration options

**Data Displayed**:
- Gift basic information (ID, amount, date)
- Constituent details
- Gift classification
- Fund allocation
- Payment information
- Attachments (images, PDFs)
- Soft credits and acknowledgements

### Lists.tsx
**Location**: `src/components/Lists.tsx`

**Size**: 26KB, 775 lines

Component for managing Blackbaud lists.

**Key Features**:
- List browsing and search
- List type filtering
- List details display
- Export functionality
- Pagination support

**Props**:
- `sessionInfo`: Session information

### Queries.tsx
**Location**: `src/components/Queries.tsx`

**Size**: 23KB, 705 lines

Component for managing Blackbaud queries.

**Key Features**:
- Query browsing and search
- Query execution
- Results display
- Export functionality
- Pagination support

**Props**:
- `sessionInfo`: Session information

### ConstituentManager.tsx
**Location**: `src/components/ConstituentManager.tsx`

**Size**: 10KB, 306 lines

Component for managing constituent information.

**Key Features**:
- Constituent profile display
- Contact information
- Address management
- Demographic data
- Relationship information

**Props**:
- `constituentId`: Constituent identifier
- `sessionInfo`: Session information

## Utility Components

### PdfViewer.tsx
**Location**: `src/components/PdfViewer.tsx`

**Size**: 11KB, 382 lines

Component for viewing PDF documents using PDF.js.

**Key Features**:
- PDF document rendering
- Zoom controls
- Page navigation
- Download functionality
- Error handling for corrupted PDFs

**Props**:
- `url`: PDF document URL
- `title`: Document title
- `onClose`: Close handler

### CacheStatistics.tsx
**Location**: `src/components/CacheStatistics.tsx`

**Size**: 14KB, 374 lines

Component for monitoring cache performance and statistics.

**Key Features**:
- Cache hit/miss statistics
- Memory usage monitoring
- Cache entry details
- Cache cleanup controls
- Performance metrics

**Props**:
- `sessionInfo`: Session information

## Component Patterns

### Lazy Loading
Components are lazy-loaded for better performance:

```typescript
const GiftList = React.lazy(() => import("./GiftList"));
const CacheStatistics = React.lazy(() => import("./CacheStatistics"));
```

### Suspense Fallbacks
Loading states are handled with Suspense:

```typescript
<Suspense fallback={<LoadingFallback message={t('common.loadingContent')} />}>
  <Routes>
    {/* Route definitions */}
  </Routes>
</Suspense>
```

### Internationalization
All components support internationalization:

```typescript
const { t } = useTranslation();
return <h1>{t('dashboard.title')}</h1>;
```

### TypeScript Interfaces
Components use TypeScript for type safety:

```typescript
interface DashboardProps {
  sessionInfo: SessionInfo | null;
}

const Dashboard: React.FC<DashboardProps> = ({ sessionInfo }) => {
  // Component implementation
};
```

## Styling Patterns

### Inline Styles
Components use inline styles for dynamic styling:

```typescript
const containerStyle: React.CSSProperties = {
  maxWidth: "1400px",
  margin: "0 auto",
  padding: "20px",
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  borderRadius: "15px",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
  backdropFilter: "blur(10px)",
};
```

### CSS Animations
Loading spinners and animations:

```typescript
const spinnerStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  border: "3px solid #f3f3f3",
  borderTop: "3px solid #2196F3",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  marginBottom: "15px",
};
```

## State Management

### Local State
Components use React hooks for local state:

```typescript
const [activeTab, setActiveTab] = useState<string>(tab || "gifts");
const [loading, setLoading] = useState<boolean>(true);
```

### Service Integration
Components integrate with the authentication service:

```typescript
import authService, { SessionInfo } from "../services/authService";

const handleLogout = async (): Promise<void> => {
  try {
    await authService.logout();
  } catch (error) {
    console.error("Logout error:", error);
  }
};
```

## Error Handling

### Try-Catch Blocks
Components include comprehensive error handling:

```typescript
try {
  const data = await authService.apiRequest('/endpoint');
} catch (error) {
  console.error('API error:', error);
  // Handle error appropriately
}
```

### User-Friendly Messages
Error messages are internationalized:

```typescript
const errorMessage = t('errors.apiRequestFailed');
```

## Performance Optimizations

### Memoization
Components use React.memo for performance:

```typescript
const LoadingFallback: React.FC<{ message?: string }> = React.memo(({ message }) => {
  // Component implementation
});
```

### Event Handlers
Optimized event handlers with proper cleanup:

```typescript
const handleMouseOver = (e: React.MouseEvent<HTMLButtonElement>): void => {
  const target = e.target as HTMLButtonElement;
  target.style.opacity = "0.8";
};
```

## Accessibility

### ARIA Labels
Components include proper ARIA labels:

```typescript
<button
  aria-label={t('dashboard.logoutButton')}
  onClick={handleLogout}
>
  {t('dashboard.logout')}
</button>
```

### Keyboard Navigation
Components support keyboard navigation:

```typescript
const handleKeyDown = (e: React.KeyboardEvent): void => {
  if (e.key === 'Enter' || e.key === ' ') {
    handleClick();
  }
};
```

## Testing Considerations

### Component Testing
Components are designed for testability:

```typescript
// Props are well-defined for testing
interface TestableComponentProps {
  data: TestData;
  onAction: (action: string) => void;
  isLoading?: boolean;
}
```

### Mock Integration
Components can be easily mocked for testing:

```typescript
// Mock the auth service for testing
jest.mock('../services/authService', () => ({
  checkAuthentication: jest.fn(),
  logout: jest.fn(),
}));
```

## Future Enhancements

### Planned Features
- Virtual scrolling for large datasets
- Advanced filtering and search
- Real-time data updates
- Offline support
- Progressive Web App features

### Component Refactoring
- Extract reusable UI components
- Implement design system
- Add component storybook
- Improve accessibility compliance 