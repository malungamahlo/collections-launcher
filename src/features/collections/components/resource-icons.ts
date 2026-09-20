import {
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  type LucideIcon,
} from 'lucide-react'
import type { ResourceIconKey } from '../model/resource-kind-registry'

/**
 * Maps the registry's icon keys to components. The registry (a model-layer
 * file) names an icon with a string key so it never imports React or an icon
 * library; this is the one place those keys become components. Typed over the
 * whole `ResourceIconKey` union, so adding a key to the registry without
 * giving it an icon here is a compile error.
 *
 * Exported as a constant to be indexed directly (`RESOURCE_ICONS[key]`), the
 * way `COLLECTION_ICONS` is: looking a component up in a module-level map is
 * static, whereas returning one from a function call is flagged as creating a
 * component during render.
 */
export const RESOURCE_ICONS: Readonly<Record<ResourceIconKey, LucideIcon>> = {
  file: File,
  'file-text': FileText,
  'file-code': FileCode2,
  'file-type': FileType,
  'file-spreadsheet': FileSpreadsheet,
  presentation: Presentation,
}
