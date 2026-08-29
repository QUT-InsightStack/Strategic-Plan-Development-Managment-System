const { useEffect, useRef } = React;

/**
 * Keyboard and focus behaviour for the modal dialogs on this page.
 *
 * `aria-modal="true"` tells assistive technology that a dialog is modal, but
 * nothing enforces it: without this, Tab walks straight out of the dialog into
 * the page behind it, and Escape does nothing. Keyboard and screen-reader
 * users end up interacting with a table they cannot see past the overlay.
 *
 * While the dialog is open this moves focus to the first editable control,
 * keeps Tab and Shift+Tab cycling inside the dialog, closes on Escape, and
 * restores focus to whatever was focused beforehand — normally the row's Edit
 * button, so the user returns to where they were.
 *
 * Returns a ref to attach to the dialog element.
 */

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useDialogBehaviour(open, onRequestClose) {
    const containerRef = useRef(null);
    const returnFocusRef = useRef(null);
    const closeRef = useRef(onRequestClose);

    // Kept in a ref so the effect below depends only on `open`. Depending on
    // the callback itself would re-run the effect on every render and pull
    // focus back to the first field after each keystroke.
    useEffect(() => {
        closeRef.current = onRequestClose;
    });

    useEffect(() => {
        if (!open) return undefined;

        const container = containerRef.current;
        if (!container) return undefined;

        returnFocusRef.current = document.activeElement;

        function focusable() {
            return Array.from(container.querySelectorAll(FOCUSABLE));
        }

        // Prefer the first field the user can actually type in over the
        // close button, which is first in the DOM.
        const initial = container.querySelector(
            '.ui-input:not([disabled]), .ui-select:not([disabled]), textarea:not([disabled])'
        ) || focusable()[0];

        if (initial) initial.focus();

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeRef.current();
                return;
            }

            if (event.key !== 'Tab') return;

            const items = focusable();
            if (items.length === 0) return;

            const first = items[0];
            const last = items[items.length - 1];

            // Wrap at both ends, and pull focus back if it has escaped the
            // dialog entirely (for instance after a click on the backdrop).
            if (!container.contains(document.activeElement)) {
                event.preventDefault();
                first.focus();
            } else if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown, true);

        return () => {
            document.removeEventListener('keydown', onKeyDown, true);

            const target = returnFocusRef.current;
            if (target && typeof target.focus === 'function' && document.contains(target)) {
                target.focus();
            }
        };
    }, [open]);

    return containerRef;
}
