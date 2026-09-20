import { File, Globe2 } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { Dialog } from '@app/shared/components/ui/dialog'
import type { AddResourceType } from '../hooks/use-add-resource'

interface AddResourceDialogProps {
  readonly type: AddResourceType
  readonly onTypeChange: (type: AddResourceType) => void
  /** While a save or the file picker is in progress the type can't be changed. */
  readonly isBusy: boolean
  /** The form shown for the Website type. */
  readonly websiteForm: ReactNode
  /** The form shown for the File type. */
  readonly fileForm: ReactNode
  readonly fallbackFocusRef?: RefObject<HTMLElement | null>
  readonly onClose: () => void
}

const TYPE_OPTIONS = [
  { type: 'website', label: 'Website', Icon: Globe2 },
  { type: 'file', label: 'File', Icon: File },
] as const

/**
 * The single "Add resource" dialog: a Website / File switch above whichever
 * form is chosen. It owns only the chrome — the title, the switch, and which
 * form is shown; the forms themselves (and everything they do) are passed in.
 */
export function AddResourceDialog({
  type,
  onTypeChange,
  isBusy,
  websiteForm,
  fileForm,
  fallbackFocusRef,
  onClose,
}: AddResourceDialogProps) {
  const groupName = useId()
  const radioRefs = useRef<Partial<Record<AddResourceType, HTMLInputElement | null>>>({})
  const hasSwitchedRef = useRef(false)

  // Each form focuses its own first field when it appears. That is right when
  // the dialog opens, but after a *switch* it would pull focus off the radio a
  // keyboard user has just arrowed onto, breaking arrow-key navigation. So,
  // once the user has switched, keep focus on the selected radio.
  useEffect(() => {
    if (hasSwitchedRef.current) {
      radioRefs.current[type]?.focus()
    }
  }, [type])

  return (
    <Dialog
      title="Add a resource"
      description="Save a website or a file inside one of your collections."
      fallbackFocusRef={fallbackFocusRef}
      onClose={onClose}
    >
      <div
        role="radiogroup"
        aria-label="Resource type"
        className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
      >
        {TYPE_OPTIONS.map(option => (
          <label
            key={option.type}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-card-foreground has-[:checked]:bg-card has-[:checked]:text-card-foreground has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
          >
            <input
              ref={element => {
                radioRefs.current[option.type] = element
              }}
              type="radio"
              name={groupName}
              className="sr-only"
              checked={type === option.type}
              disabled={isBusy}
              onChange={() => {
                hasSwitchedRef.current = true
                onTypeChange(option.type)
              }}
            />
            <option.Icon className="size-4" aria-hidden="true" />
            {option.label}
          </label>
        ))}
      </div>

      {type === 'website' ? websiteForm : fileForm}
    </Dialog>
  )
}
