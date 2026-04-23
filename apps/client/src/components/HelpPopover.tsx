import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { createPortal } from "react-dom";

type HelpPopoverGroupContextValue = {
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
};

const HelpPopoverGroupContext = createContext<HelpPopoverGroupContextValue | null>(null);
const POPOVER_ANCHOR_SELECTOR = [
  ".wizard-attr-row",
  ".trait-row",
  ".field-control-with-help",
  ".sheet-meta-item"
].join(", ");

export function HelpPopoverGroup({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const value = useMemo(() => ({ activeId, setActiveId }), [activeId]);

  return (
    <HelpPopoverGroupContext.Provider value={value}>
      {children}
    </HelpPopoverGroupContext.Provider>
  );
}

export function HelpPopoverButton({
  text,
  popoverId,
  className,
  buttonClassName,
  buttonLabel = "?",
  ariaLabel = "Открыть описание",
  showWhenEmpty = false
}: {
  text?: string | null;
  popoverId?: string;
  className?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  ariaLabel?: string;
  showWhenEmpty?: boolean;
}) {
  const normalizedText = text?.trim();
  const group = useContext(HelpPopoverGroupContext);
  const [localActiveId, setLocalActiveId] = useState<string | null>(null);
  const activeId = group?.activeId ?? localActiveId;
  const setActiveId = group?.setActiveId ?? setLocalActiveId;
  const fallbackId = useId();
  const resolvedId = popoverId ?? fallbackId;
  const isDisabled = !normalizedText;
  const isOpen = !isDisabled && activeId === resolvedId;
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [positionStyle, setPositionStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const anchorElement = button.closest<HTMLElement>(POPOVER_ANCHOR_SELECTOR) ?? button;
      const anchor = anchorElement.getBoundingClientRect();

      const viewportPadding = 8;
      const top = anchor.bottom + 8;
      const viewportWidth = window.innerWidth;
      const popoverWidth =
        popoverRef.current?.offsetWidth ?? Math.min(420, Math.max(280, viewportWidth - 16));
      const left = Math.min(
        Math.max(viewportPadding, anchor.left),
        Math.max(viewportPadding, viewportWidth - popoverWidth - viewportPadding)
      );
      const maxHeight = Math.max(0, window.innerHeight - top - 12);

      setPositionStyle({
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        maxHeight: `${Math.floor(maxHeight)}px`
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setActiveId(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveId(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, setActiveId]);

  if (!normalizedText && !showWhenEmpty) {
    return null;
  }

  const paragraphs = (normalizedText ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <span
      className={[
        "help-popover",
        isOpen ? "is-open" : "",
        isDisabled ? "is-disabled" : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={buttonRef}
        type="button"
        className={["help-popover-trigger", isDisabled ? "is-disabled" : "", buttonClassName ?? ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={isDisabled ? `${ariaLabel} недоступно до выбора значения` : ariaLabel}
        aria-expanded={isOpen}
        aria-controls={isDisabled ? undefined : `${resolvedId}-panel`}
        disabled={isDisabled}
        onClick={(event) => {
          if (isDisabled) return;
          event.preventDefault();
          event.stopPropagation();
          setActiveId((current) => (current === resolvedId ? null : resolvedId));
        }}
      >
        {buttonLabel}
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            id={`${resolvedId}-panel`}
            className="help-popover-panel"
            style={positionStyle}
            role="dialog"
            aria-label="Описание"
          >
            <div className="help-popover-card">
              <div className="help-popover-header">Справка</div>
              <div className="help-popover-content">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${resolvedId}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
