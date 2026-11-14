import { useRef, type KeyboardEvent } from "react";

/**
 * Keyboard behaviour of an ARIA radio group built from buttons: only the checked item is a Tab stop (roving tabindex),
 * arrow keys move the selection (wrapping), Home/End jump to the first/last item.
 */
export function useRadioGroup<T extends string>(values: readonly T[], value: T, onChange: (value: T) => void) {
  const items = useRef(new Map<T, HTMLButtonElement>());

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const last = values.length - 1;
    const current = values.indexOf(value);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = current >= last ? 0 : current + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = current <= 0 ? last : current - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextValue = values[next];
    onChange(nextValue);
    items.current.get(nextValue)?.focus();
  }

  function itemProps(itemValue: T) {
    return {
      tabIndex: itemValue === value ? 0 : -1,
      ref: (element: HTMLButtonElement | null) => {
        if (element) items.current.set(itemValue, element);
        else items.current.delete(itemValue);
      },
    };
  }

  return { onKeyDown, itemProps };
}
