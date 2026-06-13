import { useEffect, useRef, useState, type ReactNode } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { intently } from "intently";

type Page = "home" | "docs" | "lab";

const NAV: { label: string; href: string; page?: Page; ext?: boolean }[] = [
  { label: "Home", href: "/", page: "home" },
  { label: "Docs", href: "/docs", page: "docs" },
  { label: "Lab", href: "/lab", page: "lab" },
  { label: "GitHub", href: "https://github.com/seangeng/intently", ext: true },
  { label: "npm", href: "https://www.npmjs.com/package/intently", ext: true },
];

function Nav({ page }: { page: Page }) {
  return (
    <nav className="nav">
      <a className="brand" href="/">intently</a>
      <div className="nav-links">
        {NAV.map((n) => (
          <a
            key={n.label}
            href={n.href}
            className={n.page === page ? "active" : ""}
            {...(n.ext ? { target: "_blank", rel: "noreferrer" } : {})}
          >
            {n.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer>
      <p>
        By <a href="https://seangeng.com">Sean Geng</a> · the{" "}
        <a href="https://seangeng.com/writing/prefetching-on-intent">writeup</a> ·{" "}
        <a href="https://github.com/seangeng/intently">GitHub</a> ·{" "}
        <a href="https://www.npmjs.com/package/intently">npm</a> · MIT
      </p>
      <p className="muted small">
        Credits: ForesightJS, instant.page, quicklink, the Speculation Rules API,
        and my own input-anticipation work.
      </p>
    </footer>
  );
}

/**
 * Reads how THIS page actually arrived (Navigation Timing) and shows it — the
 * honest proof. A page reached via a predicted link is prerendered (activated
 * instantly) or served warm; a cold load shows its real milliseconds.
 */
function TimingHUD() {
  const [info, setInfo] = useState<{ label: string; tone: string; detail: string } | null>(null);

  useEffect(() => {
    const read = () => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | (PerformanceNavigationTiming & { activationStart?: number })
        | undefined;
      if (!nav) return;
      const prerendered = (nav.activationStart ?? 0) > 0;
      if (prerendered) {
        setInfo({ label: "prerendered", tone: "prerender", detail: "activated instantly — zero wait" });
      } else {
        const ms = Math.max(0, Math.round(nav.duration));
        setInfo({
          label: `loaded in ${ms}ms`,
          tone: ms < 120 ? "prefetch" : "base",
          detail: ms < 120 ? "served warm" : "cold navigation",
        });
      }
    };
    // activationStart is only meaningful post-activation; read on next tick.
    const t = setTimeout(read, 0);
    return () => clearTimeout(t);
  }, []);

  if (!info) return null;
  return (
    <div className={`hud ${info.tone}`} title="How this page arrived (Navigation Timing API)">
      <span className="hud-dot" />
      <div>
        <b>{info.label}</b>
        <em>{info.detail}</em>
      </div>
    </div>
  );
}

export function Chrome({ page, children }: { page: Page; children: ReactNode }) {
  // One call — binds every eligible link on the page and prefetches/prerenders
  // the one you're heading toward. This is the whole library, running live on
  // its own docs: navigate between pages and watch the HUD.
  useEffect(() => {
    const handle = intently({ prerenderThreshold: 0.85 });
    return () => handle.destroy();
  }, []);

  return (
    <>
      <Nav page={page} />
      <main>{children}</main>
      <Footer />
      <TimingHUD />
    </>
  );
}

export function Code({ children, lang = "tsx" }: { children: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const code = children.trim();
  return (
    <div className="code">
      <button
        className="copy"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
      <Highlight code={code} language={lang} theme={themes.vsDark}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre>
            {tokens.map((line, i) => {
              const { key: _lk, ...lineProps } = getLineProps({ line });
              return (
                <span key={i} {...lineProps} style={{ display: "block" }}>
                  {line.map((token, k) => {
                    const { key: _tk, ...tokenProps } = getTokenProps({ token });
                    return <span key={k} {...tokenProps} />;
                  })}
                </span>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/** Small shared ref-based rAF helper used by the demos. */
export function useRaf(cb: (t: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let raf = 0;
    const tick = (t: number) => { ref.current(t); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}
