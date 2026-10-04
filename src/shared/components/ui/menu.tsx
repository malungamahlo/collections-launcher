import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@app/shared/lib/utils'

export interface MenuItem {
  readonly label: string
  readonly icon?: ReactNode
  /** Runs straight from the click (or key press) that chose it. */
  readonly onSelect: () => void
}

interface MenuProps {
  /** The trigger's accessible name, e.g. "More options for Report". */
  readonly label: string
  /** What the trigger shows — usually an icon. */
  readonly children: ReactNode
  readonly items: readonly MenuItem[]
  readonly triggerClassName?: string
}

interface Position {
  readonly top: number
  readonly left: number
  readonly placement: 'below' | 'above'
}

/** Space kept between the trigger and the menu, and from the edge of the window. */
const GAP = 6
/** How wide the menu is laid out to be, for keeping it inside the window. */
const MENU_WIDTH = 224

/**
 * A button that opens a short list of actions — a menu, not a dialog. The
 * list is drawn over everything (in a portal, at a fixed position next to
 * the trigger), so a scrolling or clipped container around the trigger never
 * cuts it off; it opens upwards when there is no room below.
 *
 * It follows the menu-button pattern: arrow keys, Home and End move between
 * items, Escape and Tab close it, a click outside closes it, and focus goes
 * back to the trigger when it closes. Choosing an item calls its `onSelect`
 * directly from that click or key press, so actions that need a user gesture
 * (a permission prompt, opening a file) still get one.
 */
export function Menu({ label, children, items, triggerClassName }: MenuProps) {
  const [position, setPosition] = useState<Position>()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const isOpen = position !== undefined

  const close = useCallback((returnFocus: boolean) => {
    setPosition(undefined)

    if (returnFocus) {
      triggerRef.current?.focus()
    }
  }, [])

  function open(): void {
    const trigger = triggerRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const estimatedHeight = items.length * 40 + 12
    const fitsBelow = rect.bottom + GAP + estimatedHeight <= window.innerHeight

    setPosition({
      top: fitsBelow ? rect.bottom + GAP : rect.top - GAP,
      left: Math.max(GAP, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - GAP)),
      placement: fitsBelow ? 'below' : 'above',
    })
  }

  // Focus the first item as soon as the menu is on screen.
  useLayoutEffect(() => {
    if (isOpen) {
      itemRefs.current[0]?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as Node

      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        close(false)
      }
    }

    // A fixed-position menu would drift away from its trigger as the page
    // moves, so it closes when the trigger is no longer where the menu was
    // placed against. Only then: a scroll that leaves the trigger in place —
    // one elsewhere on the page, or the tail of the scroll that brought the
    // trigger into view just before it was pressed — is no reason to close.
    const trigger = triggerRef.current
    const placedAt = trigger?.getBoundingClientRect()

    function handleScroll(): void {
      const now = trigger?.getBoundingClientRect()

      if (!placedAt || !now || now.top !== placedAt.top || now.left !== placedAt.left) {
        close(false)
      }
    }

    function handleResize(): void {
      close(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, close])

  function choose(item: MenuItem): void {
    close(true)
    item.onSelect()
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const buttons = itemRefs.current
      .slice(0, items.length)
      .filter((button): button is HTMLButtonElement => button !== null)
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next: number | undefined

    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % buttons.length
        break
      case 'ArrowUp':
        next = (current - 1 + buttons.length) % buttons.length
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = buttons.length - 1
        break
      case 'Escape':
        event.preventDefault()
        close(true)
        return
      case 'Tab':
        close(false)
        return
      default:
        return
    }

    event.preventDefault()
    buttons[next]?.focus()
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      open()
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => (isOpen ? close(false) : open())}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClassName}
      >
        {children}
      </button>

      {position &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={handleMenuKeyDown}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
              transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            className="z-50 rounded-xl border border-border bg-card p-1 text-card-foreground shadow-[0_12px_30px_rgb(17_26_46_/_0.18)]"
          >
            {items.map((item, index) => (
              <button
                key={item.label}
                ref={element => {
                  itemRefs.current[index] = element
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => choose(item)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm',
                  'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                )}
              >
                {item.icon && (
                  <span aria-hidden="true" className="text-muted-foreground">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
