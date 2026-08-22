import {
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  BookOpen,
  FolderOpen,
  FileText,
  Settings,
  Search,
  Home,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Save,
  Download,
  Upload,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Info,
  HelpCircle,
  FileCheck,
  FileX,
  FileQuestion,
  FileEdit,
  Database,
  SlidersHorizontal,
  UserCog,
  ListOrdered,
  History,
  AlertTriangle as Warning,
  XCircle as Error,
  CheckCircle as Success,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Layout,
  Grid,
  History as HistoryIcon,
  Clock,
  Check,
  X as XIcon,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

import type { LucideProps } from 'lucide-react';

/**
 * Standardized icon props
 */
export interface IconProps extends LucideProps {
  name?: never; // Prevent accidental 'name' prop
}

/**
 * All available icons mapped by semantic name
 */
export const Icons = {
  // Navigation / Layout
  sidebar: LayoutDashboard,
  menu: Menu,
  close: X,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,

  // Content types
  chapters: BookOpen,
  folder: FolderOpen,
  file: FileText,
  settings: Settings,
  search: Search,
  home: Home,

  // Actions
  add: Plus,
  remove: Trash2,
  edit: Edit2,
  copy: Copy,
  save: Save,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  reload: RotateCcw,

  // Status
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
  info: Info,
  help: HelpCircle,

  // File states
  fileReady: FileCheck,
  fileMissing: FileX,
  fileInvalid: FileQuestion,
  fileChanged: FileEdit,

  // Domain
  schema: Database,
  config: SlidersHorizontal,
  profile: UserCog,
  pool: ListOrdered,
  history: History,

  // Security
  lock: Lock,
  unlock: Unlock,
  key: Key,
  eye: Eye,
  eyeOff: EyeOff,

  // Layout
  layout: Layout,
  grid: Grid,

  // Version history
  history_: HistoryIcon,
  rotateCcw: RotateCcw,
  clock: Clock,

  // Schema maintenance
  check: Check,
  x: XIcon,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,

  // Status aliases
  warning_: Warning,
  error_: Error,
  success_: Success,
} as const;

/**
 * Type for icon names
 */
export type IconName = keyof typeof Icons;

/**
 * Helper to get an icon component by name (for dynamic usage)
 */
export function getIcon(name: IconName) {
  return Icons[name];
}

/**
 * Render an icon by name with props
 * Usage: <Icon name="sidebar" size={16} className="my-icon" />
 */
export function Icon({ name, ...props }: { name: IconName } & React.SVGAttributes<SVGSVGElement>) {
  const Component = Icons[name];
  if (!Component) {
    // In dev, warn; in prod, render nothing
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Icon "${name}" not found`);
    }
    return null;
  }
  return <Component {...props} />;
}

export default Icons;